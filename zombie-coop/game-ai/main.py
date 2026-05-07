from fastapi import FastAPI
from pydantic import BaseModel
from contextlib import asynccontextmanager

import data_store
import model as model_module

@asynccontextmanager
async def lifespan(app: FastAPI):
    model_module.load_model()
    yield

app = FastAPI(title='Zombie Co-op AI Difficulty Service', lifespan=lifespan)


class TelemetryIn(BaseModel):
    wave: int
    apm: float
    avgAccuracy: float
    hpLossRate: float
    clearTime: float


class DifficultyOut(BaseModel):
    zombieSpeedMultiplier: float
    eliteSpawnChance: float
    resourceScarcity: float


@app.post('/predict', response_model=DifficultyOut)
async def predict_difficulty(data: TelemetryIn):
    sample_count = data_store.get_sample_count()
    params = model_module.predict(
        wave=data.wave,
        apm=data.apm,
        avg_accuracy=data.avgAccuracy,
        hp_loss_rate=data.hpLossRate,
        clear_time=data.clearTime,
        sample_count=sample_count
    )
    return DifficultyOut(**params)


@app.post('/collect')
async def collect_telemetry(data: TelemetryIn):
    data_store.save_telemetry(data.model_dump())
    return {'status': 'saved', 'total': data_store.get_sample_count()}


@app.get('/status')
async def status():
    count = data_store.get_sample_count()
    model_loaded = model_module._model is not None
    return {
        'telemetry_samples': count,
        'model_loaded': model_loaded,
        'using_heuristic': count < model_module.MIN_SAMPLES_TO_USE_MODEL or not model_loaded
    }
