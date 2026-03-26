from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os

from models import User

router  = APIRouter()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer  = HTTPBearer()

SECRET = os.getenv("JWT_SECRET")
ALGO   = "HS256"

if not SECRET:
    raise RuntimeError(
        "❌ JWT_SECRET environment variable is not set. "
        "Copy backend/.env.example to backend/.env and set a strong secret before running."
    )

# ── schemas ──────────────────────────────────────────────
class RegisterReq(BaseModel):
    name:     str
    email:    EmailStr
    password: str
    role:     str = "viewer"

class LoginReq(BaseModel):
    email:    EmailStr
    password: str

# ── helpers ──────────────────────────────────────────────
def make_token(user_id: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(days=7)
    return jwt.encode({"sub": user_id, "role": role, "exp": exp}, SECRET, ALGO)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGO])
        user = await User.get(payload["sub"])
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except JWTError:
        raise HTTPException(401, "Invalid token")

async def require_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user

# ── routes ───────────────────────────────────────────────
@router.post("/register")
async def register(req: RegisterReq):
    if await User.find_one(User.email == req.email):
        raise HTTPException(400, "Email already registered")
    user = User(
        name=req.name,
        email=req.email,
        password=pwd_ctx.hash(req.password),
        role=req.role,
    )
    await user.insert()
    return {"token": make_token(str(user.id), user.role), "role": user.role, "name": user.name}

@router.post("/login")
async def login(req: LoginReq):
    user = await User.find_one(User.email == req.email)
    if not user or not pwd_ctx.verify(req.password, user.password):
        raise HTTPException(401, "Invalid credentials")
    return {"token": make_token(str(user.id), user.role), "role": user.role, "name": user.name}

@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {"id": str(user.id), "name": user.name, "email": user.email, "role": user.role}
