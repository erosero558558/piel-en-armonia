<?php

require_once __DIR__ . '/flow/FlowOsConfig.php';
require_once __DIR__ . '/flow/FlowOsStore.php';
require_once __DIR__ . '/flow/FlowOsTimeline.php';

function flow_os_default_manifest()
{
    return FlowOsConfig::default_manifest();
}

function flow_os_manifest()
{
    return FlowOsConfig::manifest();
}

function flow_os_stage_map()
{
    return FlowOsConfig::stage_map();
}

function flow_os_stage(...$args)
{
    return FlowOsConfig::stage(...$args);
}

function flow_os_owner_label(...$args)
{
    return FlowOsConfig::owner_label(...$args);
}

function flow_os_stage_label(...$args)
{
    return FlowOsConfig::stage_label(...$args);
}

function flow_os_stage_rank_map()
{
    return FlowOsConfig::stage_rank_map();
}

function flow_os_detect_stage(...$args)
{
    return FlowOsConfig::detect_stage(...$args);
}

function flow_os_default_stage_map()
{
    return FlowOsConfig::default_stage_map();
}

function flow_os_journey_stage_definition(...$args)
{
    return FlowOsConfig::journey_stage_definition(...$args);
}

function flow_os_timeline_stage_catalog()
{
    return FlowOsConfig::timeline_stage_catalog();
}

function flow_os_display_stage_id(...$args)
{
    return FlowOsConfig::display_stage_id(...$args);
}

function flow_os_display_stage_label(...$args)
{
    return FlowOsConfig::display_stage_label(...$args);
}

function flow_os_stage_index(...$args)
{
    return FlowOsConfig::stage_index(...$args);
}

function flow_os_prepare_store(...$args)
{
    return FlowOsStore::prepare_store(...$args);
}

function flow_os_merge_existing_cases(...$args)
{
    return FlowOsStore::merge_existing_cases(...$args);
}

function flow_os_overlay_existing_case(...$args)
{
    return FlowOsStore::overlay_existing_case(...$args);
}

function flow_os_normalize_existing_case(...$args)
{
    return FlowOsStore::normalize_existing_case(...$args);
}

function flow_os_case_approvals_by_case_id(...$args)
{
    return FlowOsStore::case_approvals_by_case_id(...$args);
}

function flow_os_first_non_empty_timestamp(...$args)
{
    return FlowOsTimeline::first_non_empty_timestamp(...$args);
}

function flow_os_latest_timestamp(...$args)
{
    return FlowOsTimeline::latest_timestamp(...$args);
}

function flow_os_earliest_timestamp(...$args)
{
    return FlowOsTimeline::earliest_timestamp(...$args);
}

function flow_os_case_has_follow_up_signal(...$args)
{
    return FlowOsTimeline::case_has_follow_up_signal(...$args);
}

function flow_os_case_appointments(...$args)
{
    return FlowOsStore::case_appointments(...$args);
}

function flow_os_resolve_case_stage(...$args)
{
    return FlowOsStore::resolve_case_stage(...$args);
}

function flow_os_explicit_case_stage(...$args)
{
    return FlowOsStore::explicit_case_stage(...$args);
}

function flow_os_case_has_completed_visit(...$args)
{
    return FlowOsStore::case_has_completed_visit(...$args);
}

function flow_os_infer_case_stage(...$args)
{
    return FlowOsStore::infer_case_stage(...$args);
}

function flow_os_context_from_store(...$args)
{
    return FlowOsStore::context_from_store(...$args);
}

function flow_os_resolve_next_actions(...$args)
{
    return FlowOsStore::resolve_next_actions(...$args);
}

function flow_os_build_delegation_plan(...$args)
{
    return FlowOsStore::build_delegation_plan(...$args);
}

function flow_os_build_journey_snapshot(...$args)
{
    return FlowOsStore::build_journey_snapshot(...$args);
}

function flow_os_build_case_stage_counts(...$args)
{
    return FlowOsStore::build_case_stage_counts(...$args);
}

function flow_os_build_journey_activity_feed(...$args)
{
    return FlowOsTimeline::build_journey_activity_feed(...$args);
}

function flow_os_case_preview_time_in_stage_ms(...$args)
{
    return FlowOsTimeline::case_preview_time_in_stage_ms(...$args);
}

function flow_os_normalize_case_journey_history(...$args)
{
    return FlowOsTimeline::normalize_case_journey_history(...$args);
}

function flow_os_build_preview_cases(...$args)
{
    return FlowOsStore::build_preview_cases(...$args);
}

function flow_os_case_has_appointment(...$args)
{
    return FlowOsStore::case_has_appointment(...$args);
}

function flow_os_is_terminal_case_status(...$args)
{
    return FlowOsConfig::is_terminal_case_status(...$args);
}

function flow_os_detect_case_stage(...$args)
{
    return FlowOsStore::detect_case_stage(...$args);
}

function flow_os_compare_transitions_asc(...$args)
{
    return FlowOsTimeline::compare_transitions_asc(...$args);
}

function flow_os_compare_transitions_desc(...$args)
{
    return FlowOsTimeline::compare_transitions_desc(...$args);
}

function flow_os_build_transition_entry(...$args)
{
    return FlowOsTimeline::build_transition_entry(...$args);
}

function flow_os_build_case_journey_timeline(...$args)
{
    return FlowOsTimeline::build_case_journey_timeline(...$args);
}

function flow_os_build_store_journey_history(...$args)
{
    return FlowOsTimeline::build_store_journey_history(...$args);
}

function flow_os_find_case_journey_history(...$args)
{
    return FlowOsTimeline::find_case_journey_history(...$args);
}

function flow_os_build_store_journey_preview(...$args)
{
    return FlowOsTimeline::build_store_journey_preview(...$args);
}

function flow_os_build_case_journey_preview(...$args)
{
    return FlowOsTimeline::build_case_journey_preview(...$args);
}
