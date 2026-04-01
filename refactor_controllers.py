#!/usr/bin/env python3

import os
import re

routes_path = 'lib/routes.php'
with open(routes_path, 'r') as f:
    routes_content = f.read()

# $router->add('GET', 'health', [HealthController::class, 'check']);
route_pattern = re.compile(r"\$router->add\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\[([a-zA-Z0-9_]+)::class\s*,\s*'([^']+)'\](?:,\s*'([^']+)')?\s*\)")

route_map = {} # Controller -> [ { method, resource, function_name, replace_code } ]

for match in route_pattern.finditer(routes_content):
    http_method = match.group(1)
    resource = match.group(2)
    controller = match.group(3)
    func_name = match.group(4)
    
    if controller not in route_map:
        route_map[controller] = []
        
    route_map[controller].append({
        'method': http_method,
        'resource': resource,
        'function': func_name
    })

# print("Route Map:", route_map)

controllers_dir = 'controllers/'
for filename in os.listdir(controllers_dir):
    if not filename.endswith('.php'): continue
    filepath = os.path.join(controllers_dir, filename)
    
    with open(filepath, 'r') as f:
        content = f.read()
        
    controller_name = filename.replace('.php', '')
    
    # find all public static functions
    func_pattern = re.compile(r'public\s+static\s+function\s+([a-zA-Z0-9_]+)\s*\(')
    public_funcs = []
    for match in func_pattern.finditer(content):
        fname = match.group(1)
        if fname != 'handle' and not fname.startswith('__'):
            public_funcs.append(fname)
            
    if not public_funcs:
        continue
        
    mapped_funcs = set()
    if controller_name in route_map:
        mapped_funcs = { r['function'] for r in route_map[controller_name] }
        
    for fname in public_funcs:
        if fname in mapped_funcs:
            # Change to private
            content = re.sub(r'public\s+static\s+function\s+' + fname + r'\s*\(', r'private static function ' + fname + '(', content)
        else:
            # This is a helper or an unmapped function. Rename to __ + fname
            # Only if it's not a native magic method (like __construct, handled above)
            new_fname = '__' + fname
            content = re.sub(r'public\s+static\s+function\s+' + fname + r'\s*\(', r'public static function ' + new_fname + '(', content)
            
            # Find and replace internal self:: calls
            content = re.sub(r'self::' + fname + r'\(', r'self::' + new_fname + '(', content)
            
            print(f"Renamed helper {fname} to {new_fname} in {controller_name}")

    # Generate handle() method
    if controller_name in route_map:
        handle_blob = """
    public static function handle(array $context): void
    {
        $resource = $context['resource'] ?? '';
        $method = $context['method'] ?? 'GET';
        $key = "$method:$resource";
        
        switch ($key) {
"""
        for r in route_map[controller_name]:
            handle_blob += f"            case '{r['method']}:{r['resource']}':\n"
            handle_blob += f"                self::{r['function']}($context);\n"
            handle_blob += f"                return;\n"
            
        handle_blob += """            default:
                if (isset($context['action'])) {
                    $action = $context['action'];
                    switch ($action) {
"""
        # legacy action fallback
        for r in route_map[controller_name]:
            handle_blob += f"                        case '{r['function']}':\n"
            handle_blob += f"                            self::{r['function']}($context);\n"
            handle_blob += f"                            return;\n"

        handle_blob += """                    }
                }
                json_response(['ok' => false, 'error' => 'Not found in controller dispatch: ' . $key], 404);
        }
    }
"""
        
        # Insert handle before last closing brace in the file
        last_brace_idx = content.rfind('}')
        if last_brace_idx != -1:
            content = content[:last_brace_idx] + handle_blob + content[last_brace_idx:]
            
    with open(filepath, 'w') as f:
        f.write(content)

# Update routes.php
new_routes_content = route_pattern.sub(lambda m: f"$router->add('{m.group(1)}', '{m.group(2)}', [{m.group(3)}::class, 'handle']" + (f", '{m.group(5)}'" if m.group(5) else "") + ")", routes_content)

with open(routes_path, 'w') as f:
    f.write(new_routes_content)

print("Refactoring complete.")
