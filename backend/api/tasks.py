from fastapi import APIRouter, Depends
from celery.result import AsyncResult
from ..api.deps import get_current_user
from ..models.user import User
from ..core.exceptions import APIError

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    # In a real app we'd verify the task belongs to the user's tenant if possible, 
    # but for simplicity we rely on the UUID randomness of task_id.
    task_result = AsyncResult(task_id)
    
    response = {
        "task_id": task_id,
        "status": task_result.status,
    }
    
    if task_result.status == 'SUCCESS':
        response["result"] = task_result.result
    elif task_result.status == 'FAILURE':
        response["result"] = str(task_result.result)
        
    return response
