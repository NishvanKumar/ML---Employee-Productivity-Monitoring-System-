from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
UPLOAD_FOLDER = 'uploads'
MODEL_FOLDER = 'trained_model'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(MODEL_FOLDER, exist_ok=True)

# Global variables for model and metadata
model_metadata = {
    "model_type": "Not loaded",
    "accuracy": None,
    "last_trained": None,
    "features": [],
    "status": "No model loaded"
}

class MLModel:
    """Mock ML Model class - to be replaced with actual model"""
    
    def __init__(self):
        self.is_trained = False
        self.model = None
    
    def load_model(self, model_path):
        """Load a trained model from file"""
        try:
            # This will be implemented when the actual model is ready
            # For now, we'll create a mock model
            self.model = self.create_mock_model()
            self.is_trained = True
            return True
        except Exception as e:
            print(f"Error loading model: {e}")
            return False
    
    def create_mock_model(self):
        """Create a mock model for testing"""
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.datasets import make_classification
        
        # Create a simple mock model
        X, y = make_classification(n_samples=100, n_features=4, random_state=42)
        model = RandomForestClassifier(n_estimators=10, random_state=42)
        model.fit(X, y)
        return model
    
    def predict(self, data):
        """Make predictions on new data"""
        if not self.is_trained or self.model is None:
            return None, None
        
        try:
            if hasattr(data, 'shape'):
                n_samples = data.shape[0]
            else:
                n_samples = len(data)
                
            predictions = np.random.choice(['Class A', 'Class B', 'Class C'], n_samples)
            confidence = np.random.uniform(0.7, 0.95, n_samples)
            
            return predictions, confidence
        except Exception as e:
            print(f"Prediction error: {e}")
            return None, None

# Initialize the model
ml_model = MLModel()

def load_model_metadata():
    """Load model metadata from file"""
    global model_metadata
    try:
        metadata_path = os.path.join(MODEL_FOLDER, 'model_metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                model_metadata.update(json.load(f))
    except Exception as e:
        print(f"Error loading model metadata: {e}")

def save_model_metadata():
    """Save model metadata to file"""
    try:
        metadata_path = os.path.join(MODEL_FOLDER, 'model_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(model_metadata, f, indent=2)
    except Exception as e:
        print(f"Error saving model metadata: {e}")

def initialize_app():
    """Initialize the application"""
    print("Initializing application...")
    
    model_path = os.path.join(MODEL_FOLDER, 'model.pkl')
    if os.path.exists(model_path):
        print("Found existing model, loading...")
        if ml_model.load_model(model_path):
            model_metadata["status"] = "Model loaded successfully"
            model_metadata["last_trained"] = datetime.fromtimestamp(
                os.path.getmtime(model_path)
            ).isoformat()
            print("Model loaded successfully")
        else:
            model_metadata["status"] = "Error loading model"
            print("Error loading model")
    else:
        # Create a mock model for demonstration
        print("No model found, creating mock model for testing...")
        if ml_model.load_model("mock"):
            model_metadata.update({
                "model_type": "Random Forest (Mock)",
                "accuracy": 0.85,
                "last_trained": datetime.now().isoformat(),
                "features": ["Feature1", "Feature2", "Feature3", "Feature4"],
                "status": "Mock model loaded for testing"
            })
            save_model_metadata()
            print("Mock model created successfully")
    
    load_model_metadata()
    print("Application initialized successfully")

# --- ROUTES ---

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "message": "ML Workshop Backend is running",
        "model_status": model_metadata["status"]
    })

@app.route('/api/model-info', methods=['GET'])
def get_model_info():
    """Get information about the current model"""
    return jsonify({
        "success": True,
        "model_type": model_metadata["model_type"],
        "accuracy": model_metadata["accuracy"],
        "last_trained": model_metadata["last_trained"],
        "features": model_metadata["features"],
        "status": model_metadata["status"]
    })

@app.route('/api/predict', methods=['POST'])
def predict():
    """Make predictions on uploaded CSV data"""
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file uploaded"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400
        
        if not file.filename.lower().endswith('.csv'):
            return jsonify({"success": False, "error": "File must be CSV format"}), 400
        
        filename = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        try:
            df = pd.read_csv(filepath)
            if df.empty:
                return jsonify({"success": False, "error": "CSV file is empty"}), 400
            print(f"Successfully loaded CSV with {len(df)} rows and {len(df.columns)} columns")
        except Exception as e:
            return jsonify({"success": False, "error": f"Error reading CSV: {str(e)}"}), 400
        
        predictions, confidence = ml_model.predict(df)
        
        if predictions is None:
            return jsonify({"success": False, "error": "Model prediction failed"}), 500
        
        results = format_predictions(df, predictions, confidence)
        
        print(f"Successfully generated predictions for {len(results)} samples")
        
        return jsonify({
            "success": True,
            "predictions": results,
            "summary": {
                "total_samples": len(df),
                "model_used": model_metadata["model_type"],
                "accuracy": model_metadata["accuracy"]
            }
        })
        
    except Exception as e:
        print(f"Error in predict endpoint: {e}")
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

def format_predictions(df, predictions, confidence):
    """Format predictions for JSON response"""
    results = []
    for i, (pred, conf) in enumerate(zip(predictions, confidence)):
        results.append({
            "id": i + 1,
            "prediction": str(pred),
            "confidence": float(conf) if conf is not None else None
        })
    return results

@app.route('/api/upload-model', methods=['POST'])
def upload_model():
    """Endpoint for uploading a trained model (for ML team)"""
    return jsonify({
        "success": False,
        "error": "Model upload endpoint not implemented yet",
        "message": "This endpoint will be used by the ML team to upload their trained model"
    })

@app.route('/')
def index():
    """Root endpoint with API information"""
    return jsonify({
        "message": "ML Workshop Backend API",
        "endpoints": {
            "health": "/api/health",
            "model_info": "/api/model-info", 
            "predict": "/api/predict",
            "upload_model": "/api/upload-model"
        },
        "status": "running"
    })

# --- MAIN EXECUTION ---

if __name__ == '__main__':
    initialize_app()  # Initialize once here before starting the server
    print("=" * 50)
    print("Starting ML Workshop Backend Server...")
    print("API will be available at: http://localhost:5000")
    print("Health check: http://localhost:5000/api/health")
    print("Model info: http://localhost:5000/api/model-info")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
