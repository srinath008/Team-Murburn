"""
JWT Authentication for the Hospital API.
"""

import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
from backend.config import settings
from backend.db_services import db_get_hospital_by_id, db_create_hospital

SECRET_KEY = settings.jwt_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")
router = APIRouter(prefix="/api/auth", tags=["auth"])

class HospitalRegister(BaseModel):
    id: str
    name: str
    location: str
    phone: str
    password: str

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_hospital(token: str = Depends(oauth2_scheme)) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        hospital_id: str = payload.get("sub")
        if hospital_id is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
    return hospital_id

@router.post("/register")
async def register_hospital(hospital: HospitalRegister):
    existing = await db_get_hospital_by_id(hospital.id)
    if existing:
        raise HTTPException(status_code=400, detail="Hospital ID already registered")
    
    hashed_password = get_password_hash(hospital.password)
    new_hospital = await db_create_hospital(
        id=hospital.id,
        name=hospital.name,
        location=hospital.location,
        phone=hospital.phone,
        password_hash=hashed_password
    )
    return {"message": "Hospital registered successfully", "id": hospital.id}

@router.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    hospital = await db_get_hospital_by_id(form_data.username)
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, hospital.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "user": hospital}
