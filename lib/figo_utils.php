<?php

declare(strict_types=1);

require_once __DIR__ . '/figo/FigoSanitizer.php';
require_once __DIR__ . '/figo/FigoRouter.php';

function api_strip_utf8_bom(...$args)
{
    return FigoSanitizer::api_strip_utf8_bom(...$args);
}

function api_resolve_figo_endpoint_for_health()
{
    return FigoRouter::api_resolve_figo_endpoint_for_health();
}

function api_is_figo_recursive_config(...$args)
{
    return FigoRouter::api_is_figo_recursive_config(...$args);
}

function api_figo_config_candidate_paths()
{
    return FigoRouter::api_figo_config_candidate_paths();
}

function api_resolve_figo_config_path()
{
    return FigoRouter::api_resolve_figo_config_path();
}

function api_read_figo_config_with_meta()
{
    return FigoRouter::api_read_figo_config_with_meta();
}

function api_mask_secret_value(...$args)
{
    return FigoSanitizer::api_mask_secret_value(...$args);
}

function api_mask_figo_config(...$args)
{
    return FigoSanitizer::api_mask_figo_config(...$args);
}

function api_parse_optional_bool(...$args)
{
    return FigoSanitizer::api_parse_optional_bool(...$args);
}

function api_validate_absolute_http_url(...$args)
{
    return FigoSanitizer::api_validate_absolute_http_url(...$args);
}

function api_merge_figo_config(...$args)
{
    return FigoRouter::api_merge_figo_config(...$args);
}

function api_first_non_empty(...$args)
{
    return FigoSanitizer::api_first_non_empty(...$args);
}

function api_parse_bool(...$args)
{
    return FigoSanitizer::api_parse_bool(...$args);
}

function api_figo_read_config()
{
    return FigoRouter::api_figo_read_config();
}

function api_figo_env_ai_endpoint()
{
    return FigoRouter::api_figo_env_ai_endpoint();
}

function api_figo_env_ai_key()
{
    return FigoRouter::api_figo_env_ai_key();
}

function api_figo_env_ai_key_header()
{
    return FigoRouter::api_figo_env_ai_key_header();
}

function api_figo_env_ai_key_prefix()
{
    return FigoRouter::api_figo_env_ai_key_prefix();
}

function api_figo_env_ai_timeout_seconds()
{
    return FigoRouter::api_figo_env_ai_timeout_seconds();
}

function api_figo_env_ai_connect_timeout_seconds()
{
    return FigoRouter::api_figo_env_ai_connect_timeout_seconds();
}

function api_figo_env_ai_failfast_window_seconds()
{
    return FigoRouter::api_figo_env_ai_failfast_window_seconds();
}

function api_figo_env_ai_max_tokens()
{
    return FigoRouter::api_figo_env_ai_max_tokens();
}

function api_figo_env_ai_model()
{
    return FigoRouter::api_figo_env_ai_model();
}

function api_figo_env_allow_local_fallback()
{
    return FigoRouter::api_figo_env_allow_local_fallback();
}

function api_figo_env_provider_mode()
{
    return FigoRouter::api_figo_env_provider_mode();
}

function api_figo_env_gateway_endpoint()
{
    return FigoRouter::api_figo_env_gateway_endpoint();
}

function api_figo_env_gateway_api_key()
{
    return FigoRouter::api_figo_env_gateway_api_key();
}

function api_figo_env_gateway_model()
{
    return FigoRouter::api_figo_env_gateway_model();
}

function api_figo_env_gateway_key_header()
{
    return FigoRouter::api_figo_env_gateway_key_header();
}

function api_figo_env_gateway_key_prefix()
{
    return FigoRouter::api_figo_env_gateway_key_prefix();
}
