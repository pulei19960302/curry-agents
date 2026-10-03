import logging

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import settings
from app.infrastructure.database.session import engine


logger = logging.getLogger(__name__)
_provider: TracerProvider | None = None
_initialized = False


def setup_telemetry(app: FastAPI) -> None:
    """Initialize tracing and instrument the application's I/O boundaries."""
    global _provider, _initialized

    if _initialized or not settings.otel_enabled:
        return

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "service.version": settings.api_version,
            "deployment.environment": settings.api_env,
        }
    )
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(
        endpoint=settings.otel_exporter_otlp_endpoint,
        insecure=settings.otel_exporter_otlp_insecure,
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    _provider = provider

    FastAPIInstrumentor().instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine.sync_engine)
    HTTPXClientInstrumentor().instrument()
    RedisInstrumentor().instrument()

    _initialized = True
    logger.info(
        "OpenTelemetry initialized: service=%s endpoint=%s",
        settings.otel_service_name,
        settings.otel_exporter_otlp_endpoint,
    )


def shutdown_telemetry() -> None:
    """Flush pending spans before the API process exits."""
    global _provider, _initialized

    if _provider is not None:
        _provider.force_flush()
        _provider.shutdown()

    _provider = None
    _initialized = False
