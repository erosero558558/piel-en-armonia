import sqlite3
import pandas as pd
import numpy as np
import argparse
import joblib
import os
import sys
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from datetime import datetime

def train_model(db_path, model_path):
    print(f"Connecting to database: {db_path}")
    try:
        conn = sqlite3.connect(db_path)
        # Check if table exists
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'")
        if not cursor.fetchone():
            print("Table 'appointments' does not exist.")
            sys.exit(0)

        query = "SELECT * FROM appointments"
        df = pd.read_sql_query(query, conn)
        conn.close()
    except Exception as e:
        print(f"Error reading database: {e}")
        sys.exit(1)

    if df.empty:
        print("No appointments found in database. Cannot train model.")
        sys.exit(0)

    print(f"Loaded {len(df)} appointments.")

    # Feature Engineering
    if 'status' not in df.columns:
        print("Column 'status' not found in appointments table.")
        # Create dummy status for testing if needed? No, better to fail or warn.
        sys.exit(1)

    # Create target variable
    df['is_noshow'] = (df['status'] == 'noshow').astype(int)

    # Check if we have enough data
    if len(df) < 5:
        print("Not enough data to train a model.")
        sys.exit(0)

    # Extract features from date and time
    try:
        # Ensure date and time are strings
        df['date'] = df['date'].astype(str)
        df['time'] = df['time'].astype(str)

        # Combine date and time
        df['datetime'] = pd.to_datetime(df['date'] + ' ' + df['time'], errors='coerce')

        # Drop rows with invalid datetime
        df = df.dropna(subset=['datetime'])

        if df.empty:
            print("No valid datetime entries.")
            sys.exit(0)

        df['day_of_week'] = df['datetime'].dt.dayofweek
        df['hour'] = df['datetime'].dt.hour
        df['month'] = df['datetime'].dt.month
    except Exception as e:
        print(f"Error parsing date/time: {e}")
        sys.exit(1)

    # Features to use
    categorical_features = ['doctor', 'service', 'paymentMethod']
    numeric_features = ['day_of_week', 'hour', 'month']

    # Handle missing columns or ensure they exist
    for col in categorical_features:
        if col not in df.columns:
            df[col] = 'unknown'
        else:
            df[col] = df[col].fillna('unknown')

    for col in numeric_features:
        if col not in df.columns:
             # Should not happen as we just created them
             df[col] = 0

    X = df[categorical_features + numeric_features]
    y = df['is_noshow']

    # Preprocessing pipeline
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='unknown')),
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])

    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median'))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ])

    # Model pipeline
    # Using RandomForestClassifier
    model = Pipeline(steps=[('preprocessor', preprocessor),
                            ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))])

    # Train
    print("Training model...")
    try:
        model.fit(X, y)
    except Exception as e:
        print(f"Error training model: {e}")
        sys.exit(1)

    print("Model trained successfully.")

    # Save model
    try:
        model_dir = os.path.dirname(model_path)
        if not os.path.exists(model_dir):
            os.makedirs(model_dir)

        print(f"Saving model to {model_path}")
        joblib.dump(model, model_path)
        print("Done.")
    except Exception as e:
        print(f"Error saving model: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Train No-Show Prediction Model')
    parser.add_argument('--db-path', required=True, help='Path to SQLite database')
    parser.add_argument('--model-path', required=True, help='Path to save the trained model')

    args = parser.parse_args()

    # Basic validation of paths
    if not os.path.exists(args.db_path):
        print(f"Database file not found: {args.db_path}")
        # Allow creating a dummy model if DB is missing? No, that defeats the purpose.
        sys.exit(1)

    train_model(args.db_path, args.model_path)
