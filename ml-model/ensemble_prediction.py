"""
Advanced Ensemble Prediction System for SARDIN-AI
Implements multiple ML algorithms with ensemble methods for improved sardine prediction accuracy
"""

import numpy as np
import pandas as pd
import xgboost as xgb
import lightgbm as lgb
import catboost as cb
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge, Lasso
from sklearn.svm import SVR
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib
import logging
from typing import Dict, List, Tuple, Any
import json
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class EnsembleSardinePredictor:
    """
    Advanced ensemble predictor combining multiple ML algorithms
    for sardine school location and density prediction
    """
    
    def __init__(self, config_path: str = None):
        """
        Initialize the ensemble predictor
        
        Args:
            config_path: Path to configuration file
        """
        self.config = self._load_config(config_path)
        self.models = {}
        self.scalers = {}
        self.weights = {}
        self.feature_importance = {}
        self.prediction_history = []
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Initialize models
        self._initialize_models()
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from file"""
        default_config = {
            'ensemble': {
                'xgboost_weight': 0.3,
                'lightgbm_weight': 0.25,
                'catboost_weight': 0.2,
                'random_forest_weight': 0.15,
                'gradient_boosting_weight': 0.1
            },
            'models': {
                'xgboost': {
                    'n_estimators': 500,
                    'max_depth': 8,
                    'learning_rate': 0.05,
                    'subsample': 0.8,
                    'colsample_bytree': 0.8
                },
                'lightgbm': {
                    'n_estimators': 500,
                    'max_depth': 8,
                    'learning_rate': 0.05,
                    'num_leaves': 50,
                    'feature_fraction': 0.8
                },
                'catboost': {
                    'iterations': 500,
                    'depth': 8,
                    'learning_rate': 0.05,
                    'l2_leaf_reg': 3
                },
                'random_forest': {
                    'n_estimators': 300,
                    'max_depth': 12,
                    'min_samples_split': 5,
                    'min_samples_leaf': 2
                },
                'gradient_boosting': {
                    'n_estimators': 300,
                    'max_depth': 8,
                    'learning_rate': 0.05,
                    'subsample': 0.8
                }
            },
            'validation': {
                'cv_folds': 5,
                'test_size': 0.2,
                'random_state': 42
            }
        }
        
        if config_path:
            try:
                with open(config_path, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                self.logger.warning(f"Could not load config file: {e}")
        
        return default_config
    
    def _initialize_models(self):
        """Initialize all ML models with optimized parameters"""
        
        # XGBoost
        self.models['xgboost'] = xgb.XGBRegressor(
            objective='reg:squarederror',
            n_estimators=self.config['models']['xgboost']['n_estimators'],
            max_depth=self.config['models']['xgboost']['max_depth'],
            learning_rate=self.config['models']['xgboost']['learning_rate'],
            subsample=self.config['models']['xgboost']['subsample'],
            colsample_bytree=self.config['models']['xgboost']['colsample_bytree'],
            random_state=self.config['validation']['random_state'],
            n_jobs=-1
        )
        
        # LightGBM
        self.models['lightgbm'] = lgb.LGBMRegressor(
            objective='regression',
            n_estimators=self.config['models']['lightgbm']['n_estimators'],
            max_depth=self.config['models']['lightgbm']['max_depth'],
            learning_rate=self.config['models']['lightgbm']['learning_rate'],
            num_leaves=self.config['models']['lightgbm']['num_leaves'],
            feature_fraction=self.config['models']['lightgbm']['feature_fraction'],
            random_state=self.config['validation']['random_state'],
            n_jobs=-1,
            verbose=-1
        )
        
        # CatBoost
        self.models['catboost'] = cb.CatBoostRegressor(
            iterations=self.config['models']['catboost']['iterations'],
            depth=self.config['models']['catboost']['depth'],
            learning_rate=self.config['models']['catboost']['learning_rate'],
            l2_leaf_reg=self.config['models']['catboost']['l2_leaf_reg'],
            random_state=self.config['validation']['random_state'],
            verbose=False
        )
        
        # Random Forest
        self.models['random_forest'] = RandomForestRegressor(
            n_estimators=self.config['models']['random_forest']['n_estimators'],
            max_depth=self.config['models']['random_forest']['max_depth'],
            min_samples_split=self.config['models']['random_forest']['min_samples_split'],
            min_samples_leaf=self.config['models']['random_forest']['min_samples_leaf'],
            random_state=self.config['validation']['random_state'],
            n_jobs=-1
        )
        
        # Gradient Boosting
        self.models['gradient_boosting'] = GradientBoostingRegressor(
            n_estimators=self.config['models']['gradient_boosting']['n_estimators'],
            max_depth=self.config['models']['gradient_boosting']['max_depth'],
            learning_rate=self.config['models']['gradient_boosting']['learning_rate'],
            subsample=self.config['models']['gradient_boosting']['subsample'],
            random_state=self.config['validation']['random_state']
        )
        
        # Initialize scalers
        self.scalers['standard'] = StandardScaler()
        self.scalers['robust'] = RobustScaler()
    
    def preprocess_data(self, data: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Preprocess data for model training
        
        Args:
            data: Raw dataframe with features and target
            
        Returns:
            Tuple of (X, y) arrays
        """
        # Separate features and target
        X = data.drop(['sardine_density', 'timestamp'], axis=1, errors='ignore')
        y = data['sardine_density']
        
        # Handle missing values
        X = X.fillna(X.median())
        
        # Feature engineering
        X = self._feature_engineering(X)
        
        # Scale features
        X_scaled = self.scalers['standard'].fit_transform(X)
        
        return X_scaled, y.values
    
    def _feature_engineering(self, X: pd.DataFrame) -> pd.DataFrame:
        """
        Create additional features for better prediction
        
        Args:
            X: Feature dataframe
            
        Returns:
            Enhanced feature dataframe
        """
        # Temperature-related features
        if 'sea_surface_temp' in X.columns:
            X['temp_squared'] = X['sea_surface_temp'] ** 2
            X['temp_cubed'] = X['sea_surface_temp'] ** 3
            X['optimal_temp_range'] = ((X['sea_surface_temp'] >= 16) & 
                                       (X['sea_surface_temp'] <= 20)).astype(int)
        
        # Chlorophyll features
        if 'chlorophyll' in X.columns:
            X['chlorophyll_squared'] = X['chlorophyll'] ** 2
            X['chlorophyll_log'] = np.log1p(X['chlorophyll'])
            X['high_chlorophyll'] = (X['chlorophyll'] > 1.0).astype(int)
        
        # Depth features
        if 'depth' in X.columns:
            X['depth_squared'] = X['depth'] ** 2
            X['depth_log'] = np.log1p(X['depth'])
            X['optimal_depth'] = ((X['depth'] >= 50) & 
                                  (X['depth'] <= 150)).astype(int)
        
        # Interaction features
        if 'sea_surface_temp' in X.columns and 'chlorophyll' in X.columns:
            X['temp_chlorophyll_interaction'] = X['sea_surface_temp'] * X['chlorophyll']
        
        if 'sea_surface_temp' in X.columns and 'depth' in X.columns:
            X['temp_depth_interaction'] = X['sea_surface_temp'] * X['depth']
        
        # Seasonal features
        if 'month' in X.columns:
            X['sin_month'] = np.sin(2 * np.pi * X['month'] / 12)
            X['cos_month'] = np.cos(2 * np.pi * X['month'] / 12)
        
        return X
    
    def train_models(self, data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train all ensemble models
        
        Args:
            data: Training data with features and target
            
        Returns:
            Dictionary with training results
        """
        self.logger.info("Starting ensemble model training...")
        
        # Preprocess data
        X, y = self.preprocess_data(data)
        
        # Time series cross-validation
        tscv = TimeSeriesSplit(n_splits=self.config['validation']['cv_folds'])
        
        results = {}
        
        # Train each model
        for name, model in self.models.items():
            self.logger.info(f"Training {name} model...")
            
            # Cross-validation
            cv_scores = cross_val_score(
                model, X, y, 
                cv=tscv, 
                scoring='neg_mean_squared_error',
                n_jobs=-1
            )
            
            # Train on full dataset
            model.fit(X, y)
            
            # Store results
            results[name] = {
                'cv_rmse': np.sqrt(-cv_scores.mean()),
                'cv_std': cv_scores.std(),
                'model': model
            }
            
            # Store feature importance if available
            if hasattr(model, 'feature_importances_'):
                self.feature_importance[name] = model.feature_importances_
        
        # Calculate ensemble weights based on performance
        self._calculate_ensemble_weights(results)
        
        # Save trained models
        self._save_models()
        
        self.logger.info("Ensemble training completed successfully!")
        
        return {
            'individual_results': results,
            'ensemble_weights': self.weights,
            'feature_importance': self.feature_importance
        }
    
    def _calculate_ensemble_weights(self, results: Dict[str, Any]):
        """
        Calculate optimal weights for ensemble based on model performance
        
        Args:
            results: Individual model results
        """
        # Use inverse of RMSE as performance metric
        performances = {}
        for name, result in results.items():
            performances[name] = 1.0 / result['cv_rmse']
        
        # Normalize weights
        total_performance = sum(performances.values())
        for name in performances:
            self.weights[name] = performances[name] / total_performance
        
        # Apply configuration-based adjustments
        config_weights = self.config['ensemble']
        for name in self.weights:
            if name in config_weights:
                self.weights[name] = (self.weights[name] + config_weights[name]) / 2
        
        # Normalize final weights
        total_weight = sum(self.weights.values())
        for name in self.weights:
            self.weights[name] /= total_weight
    
    def predict(self, X: pd.DataFrame) -> Tuple[np.ndarray, Dict[str, np.ndarray]]:
        """
        Make ensemble prediction
        
        Args:
            X: Feature dataframe
            
        Returns:
            Tuple of (ensemble_prediction, individual_predictions)
        """
        # Preprocess input data
        X_processed = self._feature_engineering(X)
        X_scaled = self.scalers['standard'].transform(X_processed)
        
        individual_predictions = {}
        ensemble_prediction = np.zeros(len(X_scaled))
        
        # Get predictions from each model
        for name, model in self.models.items():
            pred = model.predict(X_scaled)
            individual_predictions[name] = pred
            ensemble_prediction += self.weights[name] * pred
        
        # Apply post-processing
        ensemble_prediction = self._post_process_predictions(ensemble_prediction)
        
        return ensemble_prediction, individual_predictions
    
    def _post_process_predictions(self, predictions: np.ndarray) -> np.ndarray:
        """
        Apply post-processing to predictions
        
        Args:
            predictions: Raw predictions
            
        Returns:
            Processed predictions
        """
        # Ensure non-negative predictions
        predictions = np.maximum(predictions, 0)
        
        # Apply smoothing for temporal consistency
        if len(predictions) > 1:
            predictions = np.convolve(predictions, np.ones(3)/3, mode='same')
        
        return predictions
    
    def predict_with_uncertainty(self, X: pd.DataFrame, n_samples: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """
        Make predictions with uncertainty estimation
        
        Args:
            X: Feature dataframe
            n_samples: Number of bootstrap samples
            
        Returns:
            Tuple of (mean_prediction, uncertainty)
        """
        predictions = []
        
        for _ in range(n_samples):
            # Bootstrap sampling
            idx = np.random.choice(len(X), len(X), replace=True)
            X_boot = X.iloc[idx]
            
            # Make prediction
            pred, _ = self.predict(X_boot)
            predictions.append(pred)
        
        predictions = np.array(predictions)
        mean_prediction = np.mean(predictions, axis=0)
        uncertainty = np.std(predictions, axis=0)
        
        return mean_prediction, uncertainty
    
    def evaluate_models(self, X_test: pd.DataFrame, y_test: np.ndarray) -> Dict[str, Any]:
        """
        Evaluate ensemble and individual models
        
        Args:
            X_test: Test features
            y_test: Test targets
            
        Returns:
            Evaluation results
        """
        # Make predictions
        ensemble_pred, individual_preds = self.predict(X_test)
        
        results = {}
        
        # Evaluate ensemble
        results['ensemble'] = {
            'rmse': np.sqrt(mean_squared_error(y_test, ensemble_pred)),
            'mae': mean_absolute_error(y_test, ensemble_pred),
            'r2': r2_score(y_test, ensemble_pred)
        }
        
        # Evaluate individual models
        for name, pred in individual_preds.items():
            results[name] = {
                'rmse': np.sqrt(mean_squared_error(y_test, pred)),
                'mae': mean_absolute_error(y_test, pred),
                'r2': r2_score(y_test, pred)
            }
        
        return results
    
    def _save_models(self):
        """Save trained models and scalers"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create directories if they don't exist
        import os
        os.makedirs('models', exist_ok=True)
        os.makedirs('scalers', exist_ok=True)
        
        # Save models
        for name, model in self.models.items():
            model_path = f'models/{name}_{timestamp}.joblib'
            joblib.dump(model, model_path)
        
        # Save scalers
        for name, scaler in self.scalers.items():
            scaler_path = f'scalers/{name}_{timestamp}.joblib'
            joblib.dump(scaler, scaler_path)
        
        # Save weights and config
        with open(f'models/ensemble_weights_{timestamp}.json', 'w') as f:
            json.dump(self.weights, f)
        
        with open(f'models/config_{timestamp}.json', 'w') as f:
            json.dump(self.config, f)
        
        self.logger.info(f"Models saved with timestamp: {timestamp}")
    
    def load_models(self, timestamp: str):
        """
        Load trained models and scalers
        
        Args:
            timestamp: Timestamp of the models to load
        """
        # Load models
        for name in self.models.keys():
            model_path = f'models/{name}_{timestamp}.joblib'
            self.models[name] = joblib.load(model_path)
        
        # Load scalers
        for name in self.scalers.keys():
            scaler_path = f'scalers/{name}_{timestamp}.joblib'
            self.scalers[name] = joblib.load(scaler_path)
        
        # Load weights
        with open(f'models/ensemble_weights_{timestamp}.json', 'r') as f:
            self.weights = json.load(f)
        
        self.logger.info(f"Models loaded with timestamp: {timestamp}")
    
    def get_feature_importance(self) -> Dict[str, np.ndarray]:
        """
        Get feature importance from all models
        
        Returns:
            Dictionary of feature importance by model
        """
        return self.feature_importance
    
    def get_model_weights(self) -> Dict[str, float]:
        """
        Get ensemble model weights
        
        Returns:
            Dictionary of model weights
        """
        return self.weights
    
    def update_model_weights(self, new_data: pd.DataFrame):
        """
        Update ensemble weights based on new data
        
        Args:
            new_data: New data for weight adjustment
        """
        self.logger.info("Updating ensemble weights...")
        
        # Preprocess new data
        X, y = self.preprocess_data(new_data)
        
        # Evaluate current models on new data
        new_results = {}
        for name, model in self.models.items():
            pred = model.predict(X)
            rmse = np.sqrt(mean_squared_error(y, pred))
            new_results[name] = {'rmse': rmse}
        
        # Recalculate weights
        self._calculate_ensemble_weights(new_results)
        
        self.logger.info("Ensemble weights updated successfully!")


def main():
    """
    Main function to demonstrate ensemble prediction system
    """
    # Initialize predictor
    predictor = EnsembleSardinePredictor()
    
    # Generate sample data (in real implementation, this would come from database)
    np.random.seed(42)
    n_samples = 1000
    
    sample_data = pd.DataFrame({
        'sea_surface_temp': np.random.normal(18, 2, n_samples),
        'chlorophyll': np.random.lognormal(0, 0.5, n_samples),
        'depth': np.random.uniform(10, 200, n_samples),
        'salinity': np.random.normal(34.5, 0.5, n_samples),
        'current_speed': np.random.exponential(0.5, n_samples),
        'month': np.random.randint(1, 13, n_samples),
        'sardine_density': np.random.gamma(2, 0.5, n_samples)
    })
    
    # Train models
    training_results = predictor.train_models(sample_data)
    
    # Make predictions
    test_data = sample_data.sample(100)
    predictions, individual_preds = predictor.predict(test_data.drop('sardine_density', axis=1))
    
    # Evaluate models
    evaluation_results = predictor.evaluate_models(
        test_data.drop('sardine_density', axis=1), 
        test_data['sardine_density'].values
    )
    
    print("Training Results:")
    for model, results in training_results['individual_results'].items():
        print(f"{model}: CV RMSE = {results['cv_rmse']:.4f}")
    
    print("\nEnsemble Weights:")
    for model, weight in training_results['ensemble_weights'].items():
        print(f"{model}: {weight:.4f}")
    
    print("\nEvaluation Results:")
    for model, results in evaluation_results.items():
        print(f"{model}: RMSE = {results['rmse']:.4f}, R² = {results['r2']:.4f}")


if __name__ == "__main__":
    main()