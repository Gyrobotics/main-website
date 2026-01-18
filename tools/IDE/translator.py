import re

def translate_kidlang_code(kidlang_code):
    lines = kidlang_code.split('\n')
    python_lines = []
    indent_level = 0
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            python_lines.append(line)
            continue
            
        current_indent = len(line) - len(line.lstrip())
        if current_indent < indent_level * 4:
            dedent_levels = (indent_level * 4 - current_indent) // 4
            indent_level -= dedent_levels
        
        line = '    ' * indent_level + stripped
        
        if stripped.startswith('say '):
            content = stripped[4:].strip()
            line = '    ' * indent_level + f'print({content})'
            
        elif stripped.startswith('set ') and ' = ' in stripped:
            assignment = stripped[4:].strip()
            line = '    ' * indent_level + assignment
            
        elif stripped.startswith('ask ') and ' -> ' in stripped:
            match = re.match(r'ask\s+(.+)\s+->\s+(.+)', stripped)
            if match:
                question, var_name = match.groups()
                # Use custom input function
                line = '    ' * indent_level + f'{var_name.strip()} = __kidlang_input({question.strip()})'
                
        elif stripped.startswith('if ') and stripped.endswith(':'):
            condition = stripped[3:-1].strip()
            line = '    ' * indent_level + f'if {condition}:'
            indent_level += 1
            
        elif stripped == 'else:':
            line = '    ' * indent_level + 'else:'
            indent_level += 1
            
        elif stripped.startswith('start ') and ' until ' in stripped and ' increase ' in stripped:
            match = re.match(r'start\s+(\w+)\s*=\s*(.+?)\s+until\s+(.+?)\s+increase\s+(\w+):', stripped)
            if match:
                var, start_val, condition, _ = match.groups()
                if '<=' in condition:
                    end_val = condition.split('<=')[1].strip()
                    line = '    ' * indent_level + f'for {var} in range(int({start_val}), int({end_val}) + 1):'
                elif '<' in condition:
                    end_val = condition.split('<')[1].strip()
                    line = '    ' * indent_level + f'for {var} in range(int({start_val}), int({end_val})):'
                else:
                    end_val = condition.split()[-1]
                    line = '    ' * indent_level + f'for {var} in range(int({start_val}), int({end_val})):'
                indent_level += 1
                
        elif stripped.startswith('start ') and ' until ' in stripped and ' decrease ' in stripped:
            match = re.match(r'start\s+(\w+)\s*=\s*(.+?)\s+until\s+(.+?)\s+decrease\s+(\w+):', stripped)
            if match:
                var, start_val, condition, _ = match.groups()
                if '>=' in condition:
                    end_val = condition.split('>=')[1].strip()
                    line = '    ' * indent_level + f'for {var} in range(int({start_val}), int({end_val}) - 1, -1):'
                elif '>' in condition:
                    end_val = condition.split('>')[1].strip()
                    line = '    ' * indent_level + f'for {var} in range(int({start_val}), int({end_val}), -1):'
                else:
                    end_val = condition.split()[-1]
                    line = '    ' * indent_level + f'for {var} in range(int({start_val}), int({end_val}), -1):'
                indent_level += 1
                
        elif stripped.startswith('define ') and stripped.endswith(':'):
            func_name = stripped[7:-1].strip()
            line = '    ' * indent_level + f'def {func_name}():'
            indent_level += 1
            
        elif stripped.startswith('do '):
            func_call = stripped[3:].strip()
            line = '    ' * indent_level + f'{func_call}()'
            
        python_lines.append(line)
    
    return '\n'.join(python_lines)