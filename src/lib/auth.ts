// Sistema de autenticación avanzado para SARDIN-AI
// Soporta JWT, OAuth2, MFA y gestión de sesiones

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'researcher' | 'fisher' | 'user';
  avatar_url?: string;
  is_active: boolean;
  email_verified: boolean;
  preferences: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
}

export interface Device {
  id: string;
  user_id: string;
  device_type: string;
  device_name?: string;
  device_id: string;
  push_token?: string;
  is_active: boolean;
  created_at: string;
  last_used: string;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: User;
}

export interface OAuthProvider {
  name: string;
  client_id: string;
  client_secret: string;
  auth_url: string;
  token_url: string;
  user_info_url: string;
  scopes: string[];
}

class AuthService {
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private bcryptRounds: number = 12;
  private accessTokenExpiry: number = 15 * 60; // 15 minutos
  private refreshTokenExpiry: number = 7 * 24 * 60 * 60; // 7 días
  private mfaCodeExpiry: number = 5 * 60; // 5 minutos

  // Proveedores OAuth2 configurados
  private oauthProviders: Map<string, OAuthProvider> = new Map([
    ['google', {
      name: 'google',
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      user_info_url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scopes: ['email', 'profile']
    }],
    ['microsoft', {
      name: 'microsoft',
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      token_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      user_info_url: 'https://graph.microsoft.com/v1.0/me',
      scopes: ['email', 'profile', 'openid']
    }]
  ]);

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
  }

  // Hash de contraseña
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  // Verificar contraseña
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generar JWT
  private generateJWT(payload: any, secret: string, expiresIn: number): string {
    return jwt.sign(payload, secret, { expiresIn });
  }

  // Verificar JWT
  private verifyJWT(token: string, secret: string): any {
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  // Registrar nuevo usuario
  async registerUser(userData: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role?: 'admin' | 'researcher' | 'fisher' | 'user';
  }): Promise<{ user: User; session: Session }> {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await db.user.findFirst({
        where: {
          OR: [
            { username: userData.username },
            { email: userData.email }
          ]
        }
      });

      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash de la contraseña
      const passwordHash = await this.hashPassword(userData.password);

      // Crear usuario
      const user = await db.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          password_hash: passwordHash,
          full_name: userData.full_name,
          role: userData.role || 'user',
          preferences: {},
          metadata: {}
        }
      });

      // Crear sesión
      const session = await this.createSession(user.id);

      return { user, session };
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }

  // Iniciar sesión
  async login(credentials: {
    username: string;
    password: string;
    ip_address?: string;
    user_agent?: string;
    device_info?: {
      device_type: string;
      device_name?: string;
      device_id: string;
      push_token?: string;
    };
  }): Promise<AuthToken> {
    try {
      // Buscar usuario
      const user = await db.user.findFirst({
        where: {
          OR: [
            { username: credentials.username },
            { email: credentials.username }
          ],
          is_active: true
        }
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verificar contraseña
      const isValidPassword = await this.verifyPassword(credentials.password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Registrar dispositivo si se proporciona
      if (credentials.device_info) {
        await this.registerDevice(user.id, credentials.device_info);
      }

      // Crear sesión
      const session = await this.createSession(
        user.id,
        credentials.ip_address,
        credentials.user_agent
      );

      // Actualizar último login
      await db.user.update({
        where: { id: user.id },
        data: { last_login: new Date().toISOString() }
      });

      // Generar tokens
      const accessToken = this.generateJWT(
        { userId: user.id, username: user.username, role: user.role },
        this.jwtSecret,
        this.accessTokenExpiry
      );

      const refreshToken = this.generateJWT(
        { userId: user.id, sessionId: session.id },
        this.jwtRefreshSecret,
        this.refreshTokenExpiry
      );

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: this.accessTokenExpiry,
        token_type: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          avatar_url: user.avatar_url,
          is_active: user.is_active,
          email_verified: user.email_verified,
          preferences: user.preferences,
          metadata: user.metadata,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login: user.last_login
        }
      };
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  }

  // Crear sesión
  private async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    try {
      const token = crypto.randomBytes(64).toString('hex');
      const expiresAt = new Date(Date.now() + this.refreshTokenExpiry * 1000);

      const session = await db.session.create({
        data: {
          user_id: userId,
          token,
          expires_at: expiresAt.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
          is_active: true
        }
      });

      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  // Registrar dispositivo
  private async registerDevice(
    userId: string,
    deviceInfo: {
      device_type: string;
      device_name?: string;
      device_id: string;
      push_token?: string;
    }
  ): Promise<Device> {
    try {
      // Buscar dispositivo existente
      let device = await db.userDevice.findFirst({
        where: { device_id: deviceInfo.device_id }
      });

      if (device) {
        // Actualizar dispositivo existente
        device = await db.userDevice.update({
          where: { id: device.id },
          data: {
            device_type: deviceInfo.device_type,
            device_name: deviceInfo.device_name,
            push_token: deviceInfo.push_token,
            is_active: true,
            last_used: new Date().toISOString()
          }
        });
      } else {
        // Crear nuevo dispositivo
        device = await db.userDevice.create({
          data: {
            user_id: userId,
            device_type: deviceInfo.device_type,
            device_name: deviceInfo.device_name,
            device_id: deviceInfo.device_id,
            push_token: deviceInfo.push_token,
            is_active: true,
            last_used: new Date().toISOString()
          }
        });
      }

      return device;
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  }

  // Verificar token de acceso
  async verifyAccessToken(token: string): Promise<User> {
    try {
      const decoded = this.verifyJWT(token, this.jwtSecret);
      
      // Verificar que el usuario existe y está activo
      const user = await db.user.findFirst({
        where: {
          id: decoded.userId,
          is_active: true
        }
      });

      if (!user) {
        throw new Error('User not found or inactive');
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        email_verified: user.email_verified,
        preferences: user.preferences,
        metadata: user.metadata,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      };
    } catch (error) {
      console.error('Error verifying access token:', error);
      throw error;
    }
  }

  // Refrescar token
  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const decoded = this.verifyJWT(refreshToken, this.jwtRefreshSecret);
      
      // Verificar que la sesión existe y está activa
      const session = await db.session.findFirst({
        where: {
          id: decoded.sessionId,
          is_active: true,
          expires_at: { gt: new Date().toISOString() }
        }
      });

      if (!session) {
        throw new Error('Invalid or expired refresh token');
      }

      // Verificar que el usuario existe y está activo
      const user = await db.user.findFirst({
        where: {
          id: session.user_id,
          is_active: true
        }
      });

      if (!user) {
        throw new Error('User not found or inactive');
      }

      // Generar nuevos tokens
      const newAccessToken = this.generateJWT(
        { userId: user.id, username: user.username, role: user.role },
        this.jwtSecret,
        this.accessTokenExpiry
      );

      const newRefreshToken = this.generateJWT(
        { userId: user.id, sessionId: session.id },
        this.jwtRefreshSecret,
        this.refreshTokenExpiry
      );

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: this.accessTokenExpiry,
        token_type: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          avatar_url: user.avatar_url,
          is_active: user.is_active,
          email_verified: user.email_verified,
          preferences: user.preferences,
          metadata: user.metadata,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login: user.last_login
        }
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  // Cerrar sesión
  async logout(accessToken: string): Promise<void> {
    try {
      const decoded = this.verifyJWT(accessToken, this.jwtSecret);
      
      // Invalidar todas las sesiones del usuario
      await db.session.updateMany({
        where: {
          user_id: decoded.userId,
          is_active: true
        },
        data: {
          is_active: false
        }
      });
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  // OAuth2 - Generar URL de autorización
  getOAuthAuthorizationUrl(provider: string, redirectUri: string): string {
    const oauthProvider = this.oauthProviders.get(provider);
    if (!oauthProvider) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    const state = crypto.randomBytes(32).toString('hex');
    const params = new URLSearchParams({
      client_id: oauthProvider.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: oauthProvider.scopes.join(' '),
      state
    });

    return `${oauthProvider.auth_url}?${params.toString()}`;
  }

  // OAuth2 - Manejar callback
  async handleOAuthCallback(
    provider: string,
    code: string,
    redirectUri: string,
    state: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthToken> {
    try {
      const oauthProvider = this.oauthProviders.get(provider);
      if (!oauthProvider) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }

      // Intercambiar código por token de acceso
      const tokenResponse = await fetch(oauthProvider.token_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: oauthProvider.client_id,
          client_secret: oauthProvider.client_secret
        })
      });

      const tokenData = await tokenResponse.json();

      // Obtener información del usuario
      const userResponse = await fetch(oauthProvider.user_info_url, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const userInfo = await userResponse.json();

      // Buscar o crear usuario
      let user = await db.user.findFirst({
        where: { email: userInfo.email }
      });

      if (!user) {
        // Crear nuevo usuario
        user = await db.user.create({
          data: {
            username: userInfo.email.split('@')[0],
            email: userInfo.email,
            password_hash: await this.hashPassword(crypto.randomBytes(32).toString('hex')),
            full_name: userInfo.name,
            role: 'user',
            email_verified: true,
            preferences: {},
            metadata: {
              oauth_provider: provider,
              oauth_id: userInfo.id
            }
          }
        });
      }

      // Crear sesión
      const session = await this.createSession(user.id, ipAddress, userAgent);

      // Generar tokens
      const accessToken = this.generateJWT(
        { userId: user.id, username: user.username, role: user.role },
        this.jwtSecret,
        this.accessTokenExpiry
      );

      const refreshToken = this.generateJWT(
        { userId: user.id, sessionId: session.id },
        this.jwtRefreshSecret,
        this.refreshTokenExpiry
      );

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: this.accessTokenExpiry,
        token_type: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          avatar_url: user.avatar_url,
          is_active: user.is_active,
          email_verified: user.email_verified,
          preferences: user.preferences,
          metadata: user.metadata,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login: user.last_login
        }
      };
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      throw error;
    }
  }

  // MFA - Generar código
  async generateMFACode(userId: string): Promise<string> {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + this.mfaCodeExpiry * 1000);

      // Guardar código en la base de datos (en un campo temporal)
      await db.user.update({
        where: { id: userId },
        data: {
          metadata: {
            ...await this.getUserMetadata(userId),
            mfa_code: code,
            mfa_expires_at: expiresAt.toISOString()
          }
        }
      });

      return code;
    } catch (error) {
      console.error('Error generating MFA code:', error);
      throw error;
    }
  }

  // MFA - Verificar código
  async verifyMFACode(userId: string, code: string): Promise<boolean> {
    try {
      const user = await db.user.findFirst({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const metadata = user.metadata;
      if (!metadata || !metadata.mfa_code || !metadata.mfa_expires_at) {
        return false;
      }

      if (metadata.mfa_code !== code) {
        return false;
      }

      if (new Date(metadata.mfa_expires_at) < new Date()) {
        return false;
      }

      // Limpiar código MFA
      await db.user.update({
        where: { id: userId },
        data: {
          metadata: {
            ...metadata,
            mfa_code: null,
            mfa_expires_at: null
          }
        }
      });

      return true;
    } catch (error) {
      console.error('Error verifying MFA code:', error);
      return false;
    }
  }

  // Obtener metadatos de usuario
  private async getUserMetadata(userId: string): Promise<Record<string, any>> {
    const user = await db.user.findFirst({
      where: { id: userId }
    });
    return user?.metadata || {};
  }

  // Cambiar contraseña
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await db.user.findFirst({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verificar contraseña actual
      const isValidPassword = await this.verifyPassword(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash de nueva contraseña
      const newPasswordHash = await this.hashPassword(newPassword);

      // Actualizar contraseña
      await db.user.update({
        where: { id: userId },
        data: {
          password_hash: newPasswordHash
        }
      });
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  // Solicitar restablecimiento de contraseña
  async requestPasswordReset(email: string): Promise<string> {
    try {
      const user = await db.user.findFirst({
        where: { email }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generar token de restablecimiento
      const resetToken = crypto.randomBytes(64).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Guardar token en metadatos
      await db.user.update({
        where: { id: user.id },
        data: {
          metadata: {
            ...user.metadata,
            reset_token: resetToken,
            reset_expires_at: expiresAt.toISOString()
          }
        }
      });

      return resetToken;
    } catch (error) {
      console.error('Error requesting password reset:', error);
      throw error;
    }
  }

  // Restablecer contraseña
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const user = await db.user.findFirst({
        where: {
          metadata: {
            path: ['reset_token'],
            equals: token
          }
        }
      });

      if (!user) {
        throw new Error('Invalid reset token');
      }

      const metadata = user.metadata;
      if (!metadata || !metadata.reset_expires_at) {
        throw new Error('Invalid reset token');
      }

      if (new Date(metadata.reset_expires_at) < new Date()) {
        throw new Error('Reset token expired');
      }

      // Hash de nueva contraseña
      const newPasswordHash = await this.hashPassword(newPassword);

      // Actualizar contraseña y limpiar token
      await db.user.update({
        where: { id: user.id },
        data: {
          password_hash: newPasswordHash,
          metadata: {
            ...metadata,
            reset_token: null,
            reset_expires_at: null
          }
        }
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  // Obtener sesiones activas del usuario
  async getUserSessions(userId: string): Promise<Session[]> {
    try {
      const sessions = await db.session.findMany({
        where: {
          user_id: userId,
          is_active: true,
          expires_at: { gt: new Date().toISOString() }
        },
        orderBy: { created_at: 'desc' }
      });

      return sessions;
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  // Cerrar sesión específica
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    try {
      await db.session.updateMany({
        where: {
          id: sessionId,
          user_id: userId
        },
        data: {
          is_active: false
        }
      });
    } catch (error) {
      console.error('Error revoking session:', error);
      throw error;
    }
  }

  // Obtener dispositivos del usuario
  async getUserDevices(userId: string): Promise<Device[]> {
    try {
      const devices = await db.userDevice.findMany({
        where: {
          user_id: userId,
          is_active: true
        },
        orderBy: { last_used: 'desc' }
      });

      return devices;
    } catch (error) {
      console.error('Error getting user devices:', error);
      return [];
    }
  }

  // Eliminar dispositivo
  async removeDevice(deviceId: string, userId: string): Promise<void> {
    try {
      await db.userDevice.updateMany({
        where: {
          id: deviceId,
          user_id: userId
        },
        data: {
          is_active: false
        }
      });
    } catch (error) {
      console.error('Error removing device:', error);
      throw error;
    }
  }
}

// Exportar instancia única del servicio
export const authService = new AuthService();
export default AuthService;