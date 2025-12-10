"""Pydantic schemas for production testing."""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


class EndpointTestResult(BaseModel):
    """Result of testing a single endpoint."""
    endpoint: str
    method: str = "GET"
    status_code: int
    response_time_ms: int
    passed: bool
    error: Optional[str] = None


class UITestResult(BaseModel):
    """Result of a single UI test."""
    test_name: str
    passed: bool
    duration_ms: int
    error: Optional[str] = None
    screenshot_url: Optional[str] = None


class HealthCheckResult(BaseModel):
    """Result of a health check."""
    endpoint: str
    status_code: int
    response_time_ms: int
    status: str  # 'healthy', 'degraded', 'down'
    body: Optional[dict] = None


# Request schemas
class TriggerProductionTestRequest(BaseModel):
    """Request to trigger a production test."""
    run_type: str = Field(default="full", description="Type of test: smoke, ui, health, full")


class UpdateProductionSettingsRequest(BaseModel):
    """Request to update production testing settings."""
    production_url: Optional[str] = None
    production_api_url: Optional[str] = None
    enable_production_testing: Optional[bool] = None
    production_test_schedule: Optional[str] = None  # 'none', 'hourly', 'daily', 'weekly'
    health_check_endpoint: Optional[str] = None
    health_check_interval_minutes: Optional[int] = None


# Response schemas
class ProductionTestRunResponse(BaseModel):
    """Response for a production test run."""
    id: str
    project_id: str
    status: str
    run_type: str
    endpoints_tested: int
    endpoints_passed: int
    endpoints_failed: int
    ui_tests_passed: int
    ui_tests_failed: int
    api_results: Optional[List[dict]] = None
    ui_results: Optional[List[dict]] = None
    health_results: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None

    class Config:
        from_attributes = True


class ProductionTestTriggerResponse(BaseModel):
    """Response after triggering a production test."""
    id: str
    status: str
    run_type: str
    created_at: datetime
    message: str


class HealthStatusResponse(BaseModel):
    """Response for health status check."""
    status: str  # 'healthy', 'degraded', 'down', 'unknown'
    last_check: Optional[datetime] = None
    response_time_ms: Optional[int] = None
    endpoint: Optional[str] = None
    details: Optional[dict] = None


class ProductionTestHistoryResponse(BaseModel):
    """Response for production test history."""
    runs: List[ProductionTestRunResponse]
    total: int
