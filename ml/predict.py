import sys
import json
import joblib
import pandas as pd
import numpy as np
import argparse
from datetime import datetime

def predict(model_path):
    # Load model
    try:
        model = joblib.load(model_path)
    except Exception as e:
        print(json.dumps({'error': f'Error loading model: {e}'}))
        sys.exit(1)

    # Read input from stdin
    try:
        input_str = sys.stdin.read()
        if not input_str:
            print(json.dumps({'error': 'No input provided'}))
            sys.exit(1)
        data = json.loads(input_str)
    except Exception as e:
        print(json.dumps({'error': f'Invalid JSON input: {e}'}))
        sys.exit(1)

    # Convert to DataFrame
    df = pd.DataFrame([data])

    # Feature Engineering (must match training)
    try:
        # Ensure date and time are strings
        if 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        else:
            df['date'] = datetime.now().strftime('%Y-%m-%d')

        if 'time' in df.columns:
            df['time'] = df['time'].astype(str)
        else:
            df['time'] = '09:00'

        df['datetime'] = pd.to_datetime(df['date'] + ' ' + df['time'], errors='coerce')

        # Handle invalid datetime
        if df['datetime'].isnull().any():
             # Fallback
             df['day_of_week'] = 0
             df['hour'] = 9
             df['month'] = 1
        else:
            df['day_of_week'] = df['datetime'].dt.dayofweek
            df['hour'] = df['datetime'].dt.hour
            df['month'] = df['datetime'].dt.month

    except Exception as e:
        # Fallback
        df['day_of_week'] = 0
        df['hour'] = 9
        df['month'] = 1

    # Ensure all required columns exist
    categorical_features = ['doctor', 'service', 'paymentMethod']
    numeric_features = ['day_of_week', 'hour', 'month']

    for col in categorical_features:
        if col not in df.columns:
            df[col] = 'unknown'
        else:
            df[col] = df[col].fillna('unknown')

    for col in numeric_features:
        if col not in df.columns:
             df[col] = 0

    # Predict
    try:
        # predict_proba returns [prob_class_0, prob_class_1]
        # We want probability of class 1 (noshow)
        classes = model.classes_
        # Find index of class 1
        if 1 in classes:
            idx = np.where(classes == 1)[0][0]
            probability = model.predict_proba(df)[0][idx]
        else:
            # If model was trained with only one class (0 or 1), handle gracefully
            # If only 0 (no noshows ever), probability of noshow is 0
            if len(classes) == 1 and classes[0] == 0:
                probability = 0.0
            elif len(classes) == 1 and classes[0] == 1:
                probability = 1.0
            else:
                 probability = 0.0 # Default fallback

        print(json.dumps({'probability': float(probability)}))
    except Exception as e:
        print(json.dumps({'error': f'Prediction error: {e}'}))
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Predict No-Show Probability')
    parser.add_argument('--model-path', required=True, help='Path to trained model')

    args = parser.parse_args()

    predict(args.model_path)
