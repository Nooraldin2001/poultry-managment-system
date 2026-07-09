"""Shared types for module reset."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ResetPlan:
    can_reset: bool = True
    affected_counts: dict = field(default_factory=dict)
    blocking_dependencies: list = field(default_factory=list)
    blocking_dependencies_ar: list = field(default_factory=list)
    required_reset_order: list = field(default_factory=list)
    side_effects: list = field(default_factory=list)
    danger_level: str = "high"
    deleted_counts: dict = field(default_factory=dict)
    recalculation: dict = field(default_factory=dict)
