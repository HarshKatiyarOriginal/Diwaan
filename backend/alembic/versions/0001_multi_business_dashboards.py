"""multi_business_dashboards

Revision ID: 0001
Revises:
Create Date: 2026-09-11 11:38:00.000000

One tenant can now own several dashboards (businesses) instead of exactly
one. `tenant_dashboards` gets its own `id` primary key, plus `name`,
`created_at`, `last_opened_at`; `tenant_id` becomes a plain indexed FK.
`widget_values` / `widget_series_points` / `ledger_events` gain a
`dashboard_id` scoping key — `widget_values`'s primary key moves from
`(tenant_id, key)` to `(dashboard_id, key)`.

SQLite has no ALTER TABLE support for changing a primary key or dropping
columns, so the SQLite branch recreates each touched table (create new,
copy rows, drop old, rename). Postgres supports these operations
natively, so the Postgres branch uses plain ALTER TABLE / constraint
statements — no table recreation, no data loss risk from a copy step.
"""
import uuid

import sqlalchemy as sa
from alembic import op

from backend.db.types import UUIDType

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == "sqlite"


def upgrade() -> None:
    if _is_sqlite():
        _upgrade_sqlite()
    else:
        _upgrade_postgres()


def _upgrade_sqlite() -> None:
    bind = op.get_bind()

    # --- tenant_dashboards: add id/name/created_at/last_opened_at, backfill, then move the PK to id ---
    with op.batch_alter_table('tenant_dashboards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('id', sa.CHAR(32), nullable=True))
        batch_op.add_column(sa.Column('name', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('created_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('last_opened_at', sa.DateTime(), nullable=True))

    rows = bind.execute(sa.text(
        "SELECT tenant_id, business_summary, generated_at FROM tenant_dashboards"
    )).fetchall()
    for tenant_id, business_summary, gen_at in rows:
        name = (business_summary or "").strip()[:60] or "My Business"
        # .hex (32-char, no dashes) to match how SQLAlchemy's Uuid type
        # stores values on SQLite — a dashed uuid.uuid4() string here
        # would silently mismatch every later `= id` lookup.
        bind.execute(sa.text(
            "UPDATE tenant_dashboards SET id = :id, name = :name, created_at = :cat, last_opened_at = :cat "
            "WHERE tenant_id = :tid"
        ), {"id": uuid.uuid4().hex, "name": name, "cat": gen_at, "tid": tenant_id})

    op.execute("""
        CREATE TABLE tenant_dashboards_new (
            id CHAR(32) NOT NULL,
            tenant_id CHAR(32) NOT NULL,
            name VARCHAR NOT NULL,
            archetype_id VARCHAR NOT NULL,
            business_summary VARCHAR NOT NULL,
            customized_parameters TEXT NOT NULL,
            active_widgets TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            last_opened_at DATETIME,
            generated_at DATETIME,
            version VARCHAR NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY(tenant_id) REFERENCES tenants (id),
            FOREIGN KEY(archetype_id) REFERENCES archetypes (id)
        )
    """)
    op.execute("""
        INSERT INTO tenant_dashboards_new
            (id, tenant_id, name, archetype_id, business_summary, customized_parameters,
             active_widgets, created_at, last_opened_at, generated_at, version)
        SELECT id, tenant_id, name, archetype_id, business_summary, customized_parameters,
               active_widgets, created_at, last_opened_at, generated_at, version
        FROM tenant_dashboards
    """)
    op.execute("DROP TABLE tenant_dashboards")
    op.execute("ALTER TABLE tenant_dashboards_new RENAME TO tenant_dashboards")
    op.execute("CREATE INDEX ix_tenant_dashboards_tenant_id ON tenant_dashboards (tenant_id)")

    # --- widget_values: add dashboard_id, backfill from tenant_id, move PK to (dashboard_id, key) ---
    op.execute("ALTER TABLE widget_values ADD COLUMN dashboard_id CHAR(32)")
    op.execute("""
        UPDATE widget_values SET dashboard_id = (
            SELECT td.id FROM tenant_dashboards td WHERE td.tenant_id = widget_values.tenant_id
        )
    """)
    op.execute("DELETE FROM widget_values WHERE dashboard_id IS NULL")
    op.execute("""
        CREATE TABLE widget_values_new (
            dashboard_id CHAR(32) NOT NULL,
            key VARCHAR NOT NULL,
            tenant_id CHAR(32) NOT NULL,
            value_json TEXT NOT NULL,
            updated_at DATETIME,
            updated_by VARCHAR,
            PRIMARY KEY (dashboard_id, key),
            FOREIGN KEY(dashboard_id) REFERENCES tenant_dashboards (id) ON DELETE CASCADE,
            FOREIGN KEY(tenant_id) REFERENCES tenants (id)
        )
    """)
    op.execute("""
        INSERT INTO widget_values_new (dashboard_id, key, tenant_id, value_json, updated_at, updated_by)
        SELECT dashboard_id, key, tenant_id, value_json, updated_at, updated_by FROM widget_values
    """)
    op.execute("DROP TABLE widget_values")
    op.execute("ALTER TABLE widget_values_new RENAME TO widget_values")
    op.execute("CREATE INDEX ix_widget_values_tenant_id ON widget_values (tenant_id)")
    op.execute("CREATE INDEX ix_widget_values_dashboard_id ON widget_values (dashboard_id)")

    # --- widget_series_points: add dashboard_id, backfill, index ---
    op.execute("ALTER TABLE widget_series_points ADD COLUMN dashboard_id CHAR(32)")
    op.execute("""
        UPDATE widget_series_points SET dashboard_id = (
            SELECT td.id FROM tenant_dashboards td WHERE td.tenant_id = widget_series_points.tenant_id
        )
    """)
    op.execute("DELETE FROM widget_series_points WHERE dashboard_id IS NULL")
    op.execute("""
        CREATE TABLE widget_series_points_new (
            id CHAR(32) NOT NULL,
            dashboard_id CHAR(32) NOT NULL,
            tenant_id CHAR(32) NOT NULL,
            key VARCHAR NOT NULL,
            ts DATETIME NOT NULL,
            value FLOAT NOT NULL,
            PRIMARY KEY (id),
            FOREIGN KEY(dashboard_id) REFERENCES tenant_dashboards (id) ON DELETE CASCADE,
            FOREIGN KEY(tenant_id) REFERENCES tenants (id)
        )
    """)
    op.execute("""
        INSERT INTO widget_series_points_new (id, dashboard_id, tenant_id, key, ts, value)
        SELECT id, dashboard_id, tenant_id, key, ts, value FROM widget_series_points
    """)
    op.execute("DROP TABLE widget_series_points")
    op.execute("ALTER TABLE widget_series_points_new RENAME TO widget_series_points")
    op.execute("CREATE INDEX ix_series_dashboard_key_ts ON widget_series_points (dashboard_id, key, ts)")
    op.execute("CREATE INDEX ix_widget_series_points_dashboard_id ON widget_series_points (dashboard_id)")

    # --- ledger_events: add dashboard_id, backfill, index ---
    op.execute("ALTER TABLE ledger_events ADD COLUMN dashboard_id CHAR(32)")
    op.execute("""
        UPDATE ledger_events SET dashboard_id = (
            SELECT td.id FROM tenant_dashboards td WHERE td.tenant_id = ledger_events.tenant_id
        )
    """)
    op.execute("DELETE FROM ledger_events WHERE dashboard_id IS NULL")
    op.execute("""
        CREATE TABLE ledger_events_new (
            id CHAR(32) NOT NULL,
            dashboard_id CHAR(32) NOT NULL,
            tenant_id CHAR(32) NOT NULL,
            key VARCHAR NOT NULL,
            label VARCHAR NOT NULL,
            fired_at DATETIME,
            fired_by VARCHAR,
            note VARCHAR,
            PRIMARY KEY (id),
            FOREIGN KEY(dashboard_id) REFERENCES tenant_dashboards (id) ON DELETE CASCADE,
            FOREIGN KEY(tenant_id) REFERENCES tenants (id)
        )
    """)
    op.execute("""
        INSERT INTO ledger_events_new (id, dashboard_id, tenant_id, key, label, fired_at, fired_by, note)
        SELECT id, dashboard_id, tenant_id, key, label, fired_at, fired_by, note FROM ledger_events
    """)
    op.execute("DROP TABLE ledger_events")
    op.execute("ALTER TABLE ledger_events_new RENAME TO ledger_events")
    op.execute("CREATE INDEX ix_ledger_events_dashboard_id ON ledger_events (dashboard_id)")

    # --- onboarding_sessions: retarget resulting_dashboard_id from tenant_id to the new dashboard id ---
    op.execute("""
        UPDATE onboarding_sessions SET resulting_dashboard_id = (
            SELECT td.id FROM tenant_dashboards td WHERE td.tenant_id = onboarding_sessions.resulting_dashboard_id
        ) WHERE resulting_dashboard_id IS NOT NULL
    """)


def _upgrade_postgres() -> None:
    # Written to mirror the SQLite path above using native ALTER TABLE —
    # not exercised against a live Postgres instance in this environment.
    # Verify against a Postgres copy of prod data before deploying.
    op.add_column('tenant_dashboards', sa.Column('id', UUIDType, nullable=True))
    op.add_column('tenant_dashboards', sa.Column('name', sa.String(), nullable=True))
    op.add_column('tenant_dashboards', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('tenant_dashboards', sa.Column('last_opened_at', sa.DateTime(), nullable=True))

    op.execute("""
        UPDATE tenant_dashboards SET
            id = gen_random_uuid(),
            name = COALESCE(NULLIF(TRIM(LEFT(business_summary, 60)), ''), 'My Business'),
            created_at = COALESCE(generated_at, now()),
            last_opened_at = generated_at
    """)

    op.alter_column('tenant_dashboards', 'id', nullable=False)
    op.alter_column('tenant_dashboards', 'name', nullable=False)
    op.alter_column('tenant_dashboards', 'created_at', nullable=False)
    op.drop_constraint('tenant_dashboards_pkey', 'tenant_dashboards', type_='primary')
    op.create_primary_key('tenant_dashboards_pkey', 'tenant_dashboards', ['id'])
    op.create_index('ix_tenant_dashboards_tenant_id', 'tenant_dashboards', ['tenant_id'])

    for table in ('widget_values', 'widget_series_points', 'ledger_events'):
        op.add_column(table, sa.Column('dashboard_id', UUIDType, nullable=True))
        op.execute(f"""
            UPDATE {table} SET dashboard_id = (
                SELECT td.id FROM tenant_dashboards td WHERE td.tenant_id = {table}.tenant_id
            )
        """)
        op.execute(f"DELETE FROM {table} WHERE dashboard_id IS NULL")
        op.alter_column(table, 'dashboard_id', nullable=False)
        op.create_foreign_key(
            f'fk_{table}_dashboard_id', table, 'tenant_dashboards',
            ['dashboard_id'], ['id'], ondelete='CASCADE',
        )
        op.create_index(f'ix_{table}_dashboard_id', table, ['dashboard_id'])

    op.drop_constraint('widget_values_pkey', 'widget_values', type_='primary')
    op.create_primary_key('widget_values_pkey', 'widget_values', ['dashboard_id', 'key'])
    op.create_index('ix_series_dashboard_key_ts', 'widget_series_points', ['dashboard_id', 'key', 'ts'])

    op.execute("""
        UPDATE onboarding_sessions SET resulting_dashboard_id = (
            SELECT td.id FROM tenant_dashboards td WHERE td.tenant_id = onboarding_sessions.resulting_dashboard_id
        ) WHERE resulting_dashboard_id IS NOT NULL
    """)


def downgrade() -> None:
    """
    Lossy: collapses each tenant back to a single dashboard — the one
    with the newest created_at (falling back to generated_at) — and
    deletes every other dashboard the tenant had, along with their
    widget_values / widget_series_points / ledger_events rows. Then
    re-keys the data tables back to tenant_id and drops the columns
    this revision added.
    """
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"

    losers = bind.execute(sa.text("""
        SELECT id FROM tenant_dashboards
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id, tenant_id,
                       ROW_NUMBER() OVER (
                           PARTITION BY tenant_id
                           ORDER BY COALESCE(created_at, generated_at) DESC
                       ) AS rn
                FROM tenant_dashboards
            ) ranked WHERE rn = 1
        )
    """)).fetchall()
    loser_ids = [row[0] for row in losers]
    for table in ("widget_values", "widget_series_points", "ledger_events"):
        for dash_id in loser_ids:
            bind.execute(sa.text(f"DELETE FROM {table} WHERE dashboard_id = :id"), {"id": dash_id})
    for dash_id in loser_ids:
        bind.execute(sa.text("DELETE FROM tenant_dashboards WHERE id = :id"), {"id": dash_id})

    if is_sqlite:
        # Batch mode reflects existing indexes and tries to recreate them
        # verbatim against the rebuilt table — drop every index that
        # references a column we're about to remove first, or the
        # recreate step fails with "no such column".
        op.execute("DROP INDEX IF EXISTS ix_series_dashboard_key_ts")
        op.execute("DROP INDEX IF EXISTS ix_widget_series_points_dashboard_id")
        with op.batch_alter_table('widget_series_points', schema=None) as batch_op:
            batch_op.drop_column('dashboard_id')

        op.execute("DROP INDEX IF EXISTS ix_ledger_events_dashboard_id")
        with op.batch_alter_table('ledger_events', schema=None) as batch_op:
            batch_op.drop_column('dashboard_id')

        op.execute("DROP INDEX IF EXISTS ix_widget_values_dashboard_id")
        with op.batch_alter_table('widget_values', schema=None) as batch_op:
            batch_op.drop_column('dashboard_id')

        op.execute("DROP INDEX IF EXISTS ix_tenant_dashboards_tenant_id")
        with op.batch_alter_table('tenant_dashboards', schema=None) as batch_op:
            batch_op.drop_column('id')
            batch_op.drop_column('name')
            batch_op.drop_column('created_at')
            batch_op.drop_column('last_opened_at')
        # Each tenant has exactly one dashboard again after the collapse
        # above, so (tenant_id) alone is unique — no PK to restore
        # explicitly; the pre-migration app code re-derives it.
    else:
        for table in ("widget_values", "widget_series_points", "ledger_events"):
            op.drop_constraint(f'fk_{table}_dashboard_id', table, type_='foreignkey')
            op.drop_index(f'ix_{table}_dashboard_id', table_name=table)
            op.drop_column(table, 'dashboard_id')
        op.drop_index('ix_series_dashboard_key_ts', table_name='widget_series_points')
        op.drop_constraint('widget_values_pkey', 'widget_values', type_='primary')
        op.create_primary_key('widget_values_pkey', 'widget_values', ['tenant_id', 'key'])
        op.drop_index('ix_tenant_dashboards_tenant_id', table_name='tenant_dashboards')
        op.drop_constraint('tenant_dashboards_pkey', 'tenant_dashboards', type_='primary')
        op.drop_column('tenant_dashboards', 'id')
        op.drop_column('tenant_dashboards', 'name')
        op.drop_column('tenant_dashboards', 'created_at')
        op.drop_column('tenant_dashboards', 'last_opened_at')
        op.create_primary_key('tenant_dashboards_pkey', 'tenant_dashboards', ['tenant_id'])
