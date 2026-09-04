from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.types import UUID

JSONType = JSON().with_variant(JSONB, "postgresql")
UUIDType = UUID(as_uuid=True).with_variant(PG_UUID(as_uuid=True), "postgresql")
