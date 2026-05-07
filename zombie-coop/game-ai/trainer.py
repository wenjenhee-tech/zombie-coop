"""
Offline retraining script. Run manually: python trainer.py
Reads telemetry from MongoDB and trains the MLP with self-supervised labels
derived from heuristic outcomes.
"""

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from data_store import get_telemetry_samples
from model import DifficultyMLP, _heuristic, save_model

EPOCHS = 80
BATCH_SIZE = 32
LR = 1e-3


def build_dataset(samples):
    X, Y = [], []
    for s in samples:
        wave = s.get('wave', 1)
        apm = s.get('apm', 0.0)
        acc = s.get('avgAccuracy', 50.0)
        hpl = s.get('hpLossRate', 0.0)
        ct = s.get('clearTime', 60)

        # Use heuristic to generate training labels
        label = _heuristic(wave, apm, acc, hpl, ct)

        # Normalise inputs
        X.append([wave / 20.0, apm / 300.0, acc / 100.0, hpl / 30.0, ct / 180.0])

        # Normalise outputs to [0,1] for Sigmoid
        speed_norm = (label['zombieSpeedMultiplier'] - 0.5) / 2.5
        Y.append([speed_norm, label['eliteSpawnChance'], label['resourceScarcity']])

    return (
        torch.tensor(X, dtype=torch.float32),
        torch.tensor(Y, dtype=torch.float32)
    )


def retrain():
    samples = get_telemetry_samples()
    if len(samples) < 10:
        print(f'Not enough samples ({len(samples)}). Need at least 10.')
        return

    print(f'Training on {len(samples)} samples...')
    X, Y = build_dataset(samples)
    dataset = TensorDataset(X, Y)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

    model = DifficultyMLP()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.MSELoss()

    model.train()
    for epoch in range(EPOCHS):
        total_loss = 0.0
        for xb, yb in loader:
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        if (epoch + 1) % 20 == 0:
            print(f'Epoch {epoch+1}/{EPOCHS}  loss={total_loss/len(loader):.4f}')

    save_model(model)
    print('Model saved to model.pth')


if __name__ == '__main__':
    retrain()
