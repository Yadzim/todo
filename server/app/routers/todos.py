from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.todo import Todo
from app.models.user import User
from app.schemas.todo import TodoCreate, TodoOut, TodoUpdate

router = APIRouter(prefix="/todos", tags=["todos"])


@router.get("", response_model=list[TodoOut])
def list_todos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Todo]:
    return list(
        db.scalars(
            select(Todo)
            .where(Todo.owner_id == current_user.id)
            .order_by(Todo.created_at.desc())
        ).all()
    )


@router.post("", response_model=TodoOut, status_code=status.HTTP_201_CREATED)
def create_todo(
    payload: TodoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Todo:
    todo = Todo(
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        owner_id=current_user.id,
    )
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


def _get_user_todo(todo_id: int, user: User, db: Session) -> Todo:
    todo = db.get(Todo, todo_id)
    if not todo or todo.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo topilmadi")
    return todo


@router.patch("/{todo_id}", response_model=TodoOut)
def update_todo(
    todo_id: int,
    payload: TodoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Todo:
    todo = _get_user_todo(todo_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)

    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()
    if "description" in data and data["description"] is not None:
        data["description"] = data["description"].strip() or None

    for key, value in data.items():
        setattr(todo, key, value)

    db.commit()
    db.refresh(todo)
    return todo


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    todo = _get_user_todo(todo_id, current_user, db)
    db.delete(todo)
    db.commit()
