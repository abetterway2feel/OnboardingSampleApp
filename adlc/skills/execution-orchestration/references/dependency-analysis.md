# Dependency Analysis Reference

Build and analyze dependency graphs to determine phase execution order.

## Graph Structure

```python
graph = {
    'nodes': {
        'PARENT-101': {
            'id': 'PARENT-101',
            'title': 'Add JWT middleware',
            'blockedBy': [],
            'blocks': ['PARENT-102', 'PARENT-103']
        },
        'PARENT-102': {
            'id': 'PARENT-102',
            'title': 'Create user model',
            'blockedBy': ['PARENT-101'],
            'blocks': ['PARENT-104']
        }
    },
    'edges': [
        {'from': 'PARENT-101', 'to': 'PARENT-102'},
        {'from': 'PARENT-101', 'to': 'PARENT-103'},
        {'from': 'PARENT-102', 'to': 'PARENT-104'}
    ],
    'waves': [
        ['PARENT-101'],                      # Wave 1
        ['PARENT-102', 'PARENT-103'],        # Wave 2
        ['PARENT-104']                       # Wave 3
    ]
}
```

## Building the Graph

```python
def analyze_dependencies(sub_issues: list) -> dict:
    graph = {'nodes': {}, 'edges': [], 'waves': []}
    for issue in sub_issues:
        issue_id = issue['identifier']
        graph['nodes'][issue_id] = {
            'id': issue_id,
            'title': issue['title'],
            'blockedBy': [],
            'blocks': []
        }
        for rel in issue.get('relations', []):
            if rel['type'] == 'blocked_by':
                graph['nodes'][issue_id]['blockedBy'].append(rel['relatedId'])
                graph['edges'].append({'from': rel['relatedId'], 'to': issue_id})
    graph['waves'] = calculate_waves(graph)
    return graph
```

## Cycle Detection

```python
def detect_cycles(graph: dict) -> list:
    visited, rec_stack, cycles = set(), set(), []
    def dfs(node, path):
        visited.add(node)
        rec_stack.add(node)
        path.append(node)
        for blocked in graph['nodes'][node].get('blocks', []):
            if blocked not in visited:
                dfs(blocked, path[:])
            elif blocked in rec_stack:
                cycle_start = path.index(blocked)
                cycles.append(path[cycle_start:] + [blocked])
        rec_stack.remove(node)
    for node in graph['nodes']:
        if node not in visited:
            dfs(node, [])
    return cycles
```

## Ready Phase Detection

```python
def get_ready_phases(graph: dict, completed: set) -> list:
    ready = []
    for node_id, node in graph['nodes'].items():
        if node_id in completed:
            continue
        if set(node.get('blockedBy', [])).issubset(completed):
            ready.append(node_id)
    return ready
```

## Wave Computation

```python
def calculate_waves(graph: dict) -> list[list[str]]:
    waves = []
    completed = set()
    remaining = set(graph['nodes'].keys())
    while remaining:
        wave = [n for n in remaining if set(graph['nodes'][n].get('blockedBy', [])).issubset(completed)]
        if not wave:
            raise CycleError("Circular dependency detected")
        waves.append(wave)
        completed.update(wave)
        remaining -= set(wave)
    return waves
```
