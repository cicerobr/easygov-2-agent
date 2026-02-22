"""
Scheduler — APScheduler-based task scheduler for running automations.
Polls the database for active automations whose next_run_at has passed.
"""
import asyncio
import logging
from datetime import datetime, time as dt_time

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_

from app.database import AsyncSessionLocal
from app.models import SearchAutomation
from app.agent.engine import run_automation

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def check_and_run_automations():
    """Check for automations that are due to run and execute them."""
    async with AsyncSessionLocal() as db:
        now = datetime.utcnow()
        current_time = now.time()

        result = await db.execute(
            select(SearchAutomation).where(
                and_(
                    SearchAutomation.is_active == True,
                    SearchAutomation.next_run_at <= now,
                )
            )
        )
        automations = result.scalars().all()

        if not automations:
            return

        logger.info(f"Found {len(automations)} automation(s) due to run")

        for automation in automations:
            # Check if within active window
            window_start = automation.active_window_start or dt_time(7, 0)
            window_end = automation.active_window_end or dt_time(22, 0)

            if not (window_start <= current_time <= window_end):
                logger.debug(
                    f"Automation '{automation.name}' outside active window "
                    f"({window_start}-{window_end}), skipping"
                )
                continue

            try:
                logger.info(f"Running automation: {automation.name}")
                await run_automation(automation, db)
            except Exception as e:
                logger.error(f"Failed to run automation '{automation.name}': {e}")


def start_scheduler():
    """Start the scheduler with a 1-minute polling interval."""
    scheduler.add_job(
        check_and_run_automations,
        trigger=IntervalTrigger(minutes=1),
        id="automation_checker",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info("Scheduler started — checking automations every minute")


def stop_scheduler():
    """Stop the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
