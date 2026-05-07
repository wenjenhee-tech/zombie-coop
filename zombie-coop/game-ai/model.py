import os
import numpy as np
import torch
import torch.nn as nn

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pth')
MIN_SAMPLES_TO_USE_MODEL = 50

# Input: [wave, apm, avgAccuracy, hpLossRate, clearTime]
# Output: [zombieSpeedMultiplier, eliteSpawnChance, resourceScarcity]

class DifficultyMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(5, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 3),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.net(x)


_model: DifficultyMLP | None = None


def load_model() -> DifficultyMLP | None:
    global _model
    if not os.path.exists(MODEL_PATH):
        return None
    m = DifficultyMLP()
    m.load_state_dict(torch.load(MODEL_PATH, map_location='cpu'))
    m.eval()
    _model = m
    return m


def save_model(model: DifficultyMLP):
    torch.save(model.state_dict(), MODEL_PATH)


def _heuristic(wave: int, apm: float, avg_accuracy: float, hp_loss_rate: float, clear_time: float) -> dict:
    """Rule-based fallback used before enough training data exists."""
    speed_mult = 1.0
    elite_chance = 0.0
    scarcity = 0.0

    struggling = hp_loss_rate > 10 or clear_time > 120
    thriving = avg_accuracy > 75 and hp_loss_rate < 3

    if struggling:
        speed_mult = max(0.7, 1.0 - (hp_loss_rate - 10) * 0.02)
        elite_chance = 0.0
    elif thriving:
        speed_mult = min(2.0, 1.0 + (avg_accuracy - 75) * 0.02)
        elite_chance = min(0.4, (avg_accuracy - 75) * 0.01)
    else:
        speed_mult = 1.0 + wave * 0.02
        elite_chance = min(0.3, wave * 0.01)

    return {
        'zombieSpeedMultiplier': round(speed_mult, 3),
        'eliteSpawnChance': round(elite_chance, 3),
        'resourceScarcity': round(scarcity, 3)
    }


def predict(wave: int, apm: float, avg_accuracy: float, hp_loss_rate: float, clear_time: float,
            sample_count: int = 0) -> dict:
    if sample_count < MIN_SAMPLES_TO_USE_MODEL or _model is None:
        return _heuristic(wave, apm, avg_accuracy, hp_loss_rate, clear_time)

    features = torch.tensor([[wave, apm, avg_accuracy, hp_loss_rate, clear_time]], dtype=torch.float32)
    with torch.no_grad():
        out = _model(features).squeeze().numpy()

    # Scale outputs to valid ranges
    speed_mult = float(0.5 + out[0] * 2.5)      # [0.5, 3.0]
    elite_chance = float(out[1])                  # [0.0, 1.0]
    scarcity = float(out[2])                      # [0.0, 1.0]

    return {
        'zombieSpeedMultiplier': round(speed_mult, 3),
        'eliteSpawnChance': round(elite_chance, 3),
        'resourceScarcity': round(scarcity, 3)
    }
