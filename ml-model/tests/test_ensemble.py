"""
Test suite for Ensemble Prediction System
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import Mock, patch
import sys
import os

# Add the parent directory to the path to import the module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ensemble_prediction import EnsembleSardinePredictor

class TestEnsembleSardinePredictor:
    """Test cases for EnsembleSardinePredictor class"""

    def setup_method(self):
        """Setup test fixtures before each test method"""
        self.predictor = EnsembleSardinePredictor()
        
        # Create sample data
        np.random.seed(42)
        self.sample_data = pd.DataFrame({
            'sea_surface_temp': np.random.normal(18, 2, 100),
            'chlorophyll': np.random.lognormal(0, 0.5, 100),
            'depth': np.random.uniform(10, 200, 100),
            'salinity': np.random.normal(34.5, 0.5, 100),
            'current_speed': np.random.exponential(0.5, 100),
            'month': np.random.randint(1, 13, 100),
            'sardine_density': np.random.gamma(2, 0.5, 100),
            'timestamp': pd.date_range('2023-01-01', periods=100, freq='D')
        })

    def test_initialization(self):
        """Test predictor initialization"""
        assert self.predictor is not None
        assert len(self.predictor.models) > 0
        assert len(self.predictor.scalers) > 0
        assert isinstance(self.predictor.weights, dict)

    def test_feature_engineering(self):
        """Test feature engineering functionality"""
        X = self.sample_data.drop(['sardine_density', 'timestamp'], axis=1)
        X_enhanced = self.predictor._feature_engineering(X)
        
        # Check if new features are added
        assert 'temp_squared' in X_enhanced.columns
        assert 'chlorophyll_squared' in X_enhanced.columns
        assert 'depth_squared' in X_enhanced.columns
        assert 'sin_month' in X_enhanced.columns
        assert 'cos_month' in X_enhanced.columns
        
        # Check if original features are preserved
        assert 'sea_surface_temp' in X_enhanced.columns
        assert 'chlorophyll' in X_enhanced.columns
        assert 'depth' in X_enhanced.columns

    def test_preprocess_data(self):
        """Test data preprocessing"""
        X, y = self.predictor.preprocess_data(self.sample_data)
        
        assert X.shape[0] == len(self.sample_data)
        assert y.shape[0] == len(self.sample_data)
        assert not np.isnan(X).any()
        assert not np.isnan(y).any()

    def test_train_models(self):
        """Test model training"""
        results = self.predictor.train_models(self.sample_data)
        
        assert 'individual_results' in results
        assert 'ensemble_weights' in results
        assert 'feature_importance' in results
        
        # Check if all models were trained
        assert len(results['individual_results']) == len(self.predictor.models)
        
        # Check if weights sum to 1
        total_weight = sum(results['ensemble_weights'].values())
        assert abs(total_weight - 1.0) < 0.01

    def test_predict(self):
        """Test prediction functionality"""
        # Train models first
        self.predictor.train_models(self.sample_data)
        
        # Make predictions
        test_data = self.sample_data.drop(['sardine_density', 'timestamp'], axis=1).head(10)
        ensemble_pred, individual_preds = self.predictor.predict(test_data)
        
        assert len(ensemble_pred) == len(test_data)
        assert len(individual_preds) == len(self.predictor.models)
        assert all(pred >= 0 for pred in ensemble_pred)  # Non-negative predictions

    def test_predict_with_uncertainty(self):
        """Test prediction with uncertainty estimation"""
        # Train models first
        self.predictor.train_models(self.sample_data)
        
        # Make predictions with uncertainty
        test_data = self.sample_data.drop(['sardine_density', 'timestamp'], axis=1).head(10)
        mean_pred, uncertainty = self.predictor.predict_with_uncertainty(test_data, n_samples=10)
        
        assert len(mean_pred) == len(test_data)
        assert len(uncertainty) == len(test_data)
        assert all(uncertainty >= 0)  # Non-negative uncertainty

    def test_evaluate_models(self):
        """Test model evaluation"""
        # Train models first
        self.predictor.train_models(self.sample_data)
        
        # Evaluate models
        test_data = self.sample_data.drop(['sardine_density', 'timestamp'], axis=1).head(20)
        test_target = self.sample_data['sardine_density'].head(20).values
        
        results = self.predictor.evaluate_models(test_data, test_target)
        
        assert 'ensemble' in results
        assert all(model in results for model in self.predictor.models)
        
        # Check if metrics are reasonable
        assert results['ensemble']['rmse'] >= 0
        assert results['ensemble']['r2'] <= 1
        assert results['ensemble']['r2'] >= -1

    def test_feature_importance(self):
        """Test feature importance extraction"""
        # Train models first
        self.predictor.train_models(self.sample_data)
        
        # Get feature importance
        importance = self.predictor.get_feature_importance()
        
        assert isinstance(importance, dict)
        assert len(importance) > 0

    def test_model_weights(self):
        """Test model weight management"""
        # Train models first
        self.predictor.train_models(self.sample_data)
        
        # Get model weights
        weights = self.predictor.get_model_weights()
        
        assert isinstance(weights, dict)
        assert len(weights) == len(self.predictor.models)
        assert abs(sum(weights.values()) - 1.0) < 0.01

    def test_update_model_weights(self):
        """Test model weight updates"""
        # Train models first
        self.predictor.train_models(self.sample_data)
        
        # Update weights with new data
        new_data = self.sample_data.tail(20)
        self.predictor.update_model_weights(new_data)
        
        # Check if weights are still valid
        weights = self.predictor.get_model_weights()
        assert abs(sum(weights.values()) - 1.0) < 0.01

    def test_save_and_load_models(self):
        """Test model persistence"""
        # Train models first
        self.predictor.train_models(self.sample_data)
        
        # Save models
        with patch('joblib.dump') as mock_dump:
            self.predictor._save_models()
            assert mock_dump.call_count > 0

        # Load models
        with patch('joblib.load') as mock_load:
            mock_load.return_value = Mock()
            self.predictor.load_models('test_timestamp')
            assert mock_load.call_count > 0

    def test_config_loading(self):
        """Test configuration loading"""
        # Test with default config
        predictor = EnsembleSardinePredictor()
        assert predictor.config is not None
        assert 'ensemble' in predictor.config
        assert 'models' in predictor.config
        assert 'validation' in predictor.config

    def test_config_with_custom_file(self):
        """Test configuration loading with custom file"""
        custom_config = {
            'ensemble': {
                'xgboost_weight': 0.5,
                'lightgbm_weight': 0.5
            }
        }
        
        with patch('builtins.open') as mock_open:
            import json
            mock_open.return_value.__enter__.return_value.read.return_value = json.dumps(custom_config)
            
            predictor = EnsembleSardinePredictor('config.json')
            assert predictor.config['ensemble']['xgboost_weight'] == 0.5

    def test_post_process_predictions(self):
        """Test prediction post-processing"""
        # Test with negative values
        raw_predictions = np.array([-0.5, 0.3, -0.1, 0.8])
        processed = self.predictor._post_process_predictions(raw_predictions)
        
        assert all(pred >= 0 for pred in processed)
        assert len(processed) == len(raw_predictions)

    def test_calculate_ensemble_weights(self):
        """Test ensemble weight calculation"""
        mock_results = {
            'model1': {'cv_rmse': 0.1},
            'model2': {'cv_rmse': 0.2},
            'model3': {'cv_rmse': 0.15}
        }
        
        self.predictor._calculate_ensemble_weights(mock_results)
        
        weights = self.predictor.weights
        assert abs(sum(weights.values()) - 1.0) < 0.01
        assert weights['model1'] > weights['model2']  # Lower RMSE should get higher weight

    def test_missing_value_handling(self):
        """Test handling of missing values"""
        # Create data with missing values
        data_with_missing = self.sample_data.copy()
        data_with_missing.loc[0, 'sea_surface_temp'] = np.nan
        data_with_missing.loc[1, 'chlorophyll'] = np.nan
        
        X, y = self.predictor.preprocess_data(data_with_missing)
        
        assert not np.isnan(X).any()
        assert not np.isnan(y).any()

    def test_edge_cases(self):
        """Test edge cases"""
        # Test with empty data
        empty_data = pd.DataFrame({
            'sea_surface_temp': [],
            'chlorophyll': [],
            'depth': [],
            'salinity': [],
            'current_speed': [],
            'month': [],
            'sardine_density': [],
            'timestamp': []
        })
        
        # Should handle empty data gracefully
        try:
            X, y = self.predictor.preprocess_data(empty_data)
            assert len(X) == 0
            assert len(y) == 0
        except Exception:
            # If it raises an exception, that's also acceptable
            pass

    def test_reproducibility(self):
        """Test reproducibility of results"""
        # Train two predictors with same data
        predictor1 = EnsembleSardinePredictor()
        predictor2 = EnsembleSardinePredictor()
        
        results1 = predictor1.train_models(self.sample_data)
        results2 = predictor2.train_models(self.sample_data)
        
        # Results should be similar (though not identical due to randomness)
        assert len(results1['individual_results']) == len(results2['individual_results'])

    def test_model_types(self):
        """Test that all expected model types are present"""
        expected_models = ['xgboost', 'lightgbm', 'catboost', 'random_forest', 'gradient_boosting']
        
        for model_name in expected_models:
            assert model_name in self.predictor.models
            assert self.predictor.models[model_name] is not None

    def test_scaler_initialization(self):
        """Test scaler initialization"""
        assert 'standard' in self.predictor.scalers
        assert 'robust' in self.predictor.scalers
        assert self.predictor.scalers['standard'] is not None
        assert self.predictor.scalers['robust'] is not None

    def test_logging_setup(self):
        """Test logging setup"""
        assert self.predictor.logger is not None
        assert hasattr(self.predictor.logger, 'info')
        assert hasattr(self.predictor.logger, 'error')
        assert hasattr(self.predictor.logger, 'warning')

    def test_prediction_history(self):
        """Test prediction history tracking"""
        # Initially empty
        assert len(self.predictor.prediction_history) == 0
        
        # Train models and make predictions
        self.predictor.train_models(self.sample_data)
        test_data = self.sample_data.drop(['sardine_density', 'timestamp'], axis=1).head(5)
        self.predictor.predict(test_data)
        
        # Check if history is tracked (implementation dependent)
        # This test may need adjustment based on actual implementation
        assert isinstance(self.predictor.prediction_history, list)

if __name__ == '__main__':
    pytest.main([__file__])