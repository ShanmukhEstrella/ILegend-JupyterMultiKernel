from ipykernel.kernelbase import Kernel
from jupyter_client import KernelManager
from queue import Empty
import traceback
import re
import os
import traceback
import tempfile
import pickle


class ILegendRouterKernel(Kernel):
    implementation = 'ilegend'
    implementation_version = '1.0'
    banner = "ILegend kernel: Route to legend_kernel or python3"
    language_info = {
        'name': 'ilegend',
        'file_extension': '.ilgd',
        'mimetype': 'text/x-ilegend',
        'codemirror_mode': 'ilegend',
    }
    user_ns={}







    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.kernel_map = {}
        self.kernel_name_map = {
            'legend': 'legend_kernel',
            'python3': 'python3'
        }









    def _handle_put_command(self, code):
        import json
        import pandas as pd
        pattern = r'%put\s+--var\s+(\w+)\s+in\s+(\w+)'
        match = re.match(pattern, code.strip())
        if not match:
            return {
                'status': 'error',
                'execution_count': self.execution_count,
                'ename': 'SyntaxError',
                'evalue': 'Invalid %put syntax',
                'traceback': ['Invalid syntax. Use: %put --var <source> in <target>']
            }
        source_var, target_var = match.groups()
        try:
            # Step 1: Request the variable's JSON from the Legend kernel
            legend_kc = self._get_kernel('legend')
            msg_id = legend_kc.execute(f"%router_json {source_var}")
            json_string = None
            while True:
                msg = legend_kc.get_iopub_msg(timeout=5)
                if msg['parent_header'].get('msg_id') != msg_id:
                    continue
                if msg['msg_type'] == 'stream' and msg['content'].get('name') == 'stdout':
                    json_string = msg['content']['text'].strip()
                elif msg['msg_type'] == 'status' and msg['content'].get('execution_state') == 'idle':
                    break
            if not json_string:
                raise ValueError("No data received from Legend kernel.")
            # Step 2: Inject code into the Python kernel to deserialize and store the variable
            python_kc = self._get_kernel('python3')
            escaped_json = repr(json_string)
            import textwrap
            escaped_json = repr(json_string)
            inject_code = textwrap.dedent(f"""
                import pandas as pd
                import io
                {target_var} = pd.read_json(io.StringIO({escaped_json}), orient='split')
            """)
            msg_id = python_kc.execute(inject_code)
            # Wait until Python kernel finishes executing
            while True:
                msg = python_kc.get_iopub_msg(timeout=5)
                if msg['parent_header'].get('msg_id') != msg_id:
                    continue
                if msg['msg_type'] == 'status' and msg['content'].get('execution_state') == 'idle':
                    break
            # Success Message to notebook
            self.send_response(self.iopub_socket, 'stream', {
                'name': 'stdout',
                'text': f"Variable '{source_var}' from Legend loaded as '{target_var}' into Python.\n"
            })
            return {
                'status': 'ok',
                'execution_count': self.execution_count,
                'payload': [],
                'user_expressions': {}
            }
        except Exception as e:
            tb = traceback.format_exc()
            self.send_response(self.iopub_socket, 'stream', {
                'name': 'stderr',
                'text': f"[Router Error] %put failed: {e}\n{tb}"
            })
            return {
                'status': 'error',
                'execution_count': self.execution_count,
                'ename': type(e).__name__,
                'evalue': str(e),
                'traceback': tb.splitlines()
            }



    




    def _launch_kernel(self, name):
        km = KernelManager(kernel_name=name)
        km.start_kernel()
        kc = km.client()
        kc.start_channels()
        return {'manager': km, 'client': kc}





    def _get_kernel(self, alias):
        name = self.kernel_name_map.get(alias)
        if not name:
            raise ValueError(f"No mapping found for kernel alias '{alias}'")
        if alias not in self.kernel_map:
            self.kernel_map[alias] = self._launch_kernel(name)
        return self.kernel_map[alias]['client']




    def _extract_kernel_choice(self, code: str):
        lines = code.strip().splitlines()
        if lines and lines[0].lower().startswith("#kernel:"):
            first = lines[0].split(":", 1)[1].strip().lower()
            if first == "python":
                return "python3"
            elif first == "legend":
                return "legend"
        return "legend"  # default





    def _strip_first_line(self, code: str) -> str:
        lines = code.splitlines()
        if lines and lines[0].lower().startswith("#kernel:"):
            return "\n".join(lines[1:])
        return code





    def do_execute(self, code, silent, store_history=True, user_expressions=None, allow_stdin=False):
        try:
            kernel_choice = self._extract_kernel_choice(code)
            exec_code = self._strip_first_line(code)
            kc = self._get_kernel(kernel_choice)
        except Exception as e:
            tb = traceback.format_exc()
            self.send_response(self.iopub_socket, 'stream', {
                'name': 'stderr',
                'text': f"[Router Error] Failed to route: {e}\n{tb}"
            })
            return {
                'status': 'error',
                'execution_count': self.execution_count,
                'ename': type(e).__name__,
                'evalue': str(e),
                'traceback': tb.splitlines()
            }
        if code.strip().startswith('%put'):
            self._handle_put_command(code)
            return {
                'status': 'ok',
                'execution_count': self.execution_count,
                'payload': [],
                'user_expressions': {}
            }
        else:
            msg_id = kc.execute(exec_code)
            while True:
                try:
                    msg = kc.get_iopub_msg(timeout=10)
                except Empty:
                    break
                except Exception as e:
                    tb = traceback.format_exc()
                    self.send_response(self.iopub_socket, 'stream', {
                        'name': 'stderr',
                        'text': f"[Router Error] Subkernel output error: {e}\n{tb}"
                    })
                    break

                if msg['parent_header'].get('msg_id') != msg_id:
                    continue
                msg_type = msg['msg_type']
                content = msg['content']
                if msg_type == 'clear_output':
                    self.session.send(self.iopub_socket, msg_type, content, parent=self._parent_header)
                elif msg_type in {'stream', 'display_data', 'execute_result', 'error'}:
                    if msg_type == 'execute_result':
                        msg_type = 'display_data'
                        content = {
                            'data':       content['data'],
                            'metadata':   content.get('metadata', {})
                        }
                    self.session.send(self.iopub_socket, msg_type, content,parent=self._parent_header)
                elif msg_type == 'status' and content.get('execution_state') == 'idle':
                    break
            self.session.send(
                self.shell_stream,
                'execute_reply',
                {
                    'status': 'ok',
                    'execution_count': self.execution_count,
                    'payload': [],
                    'user_expressions': {}
                },
                parent=self._parent_header
            )
            return {
                'status': 'ok',
                'execution_count': self.execution_count,
                'payload': [],
                'user_expressions': {}
            }






    def do_complete(self, code, cursor_pos):
        kernel_choice = self._extract_kernel_choice(code)
        code_without_header = self._strip_first_line(code)
        # Adjust cursor position by removing header length
        adjustment = len(code.splitlines()[0]) + 1 if code.lower().startswith("#kernel:") else 0
        adjusted_cursor = max(cursor_pos - adjustment, 0)

        try:
            kc = self._get_kernel(kernel_choice)
        except Exception:
            return {
                'status': 'ok',
                'matches': [],
                'cursor_start': cursor_pos,
                'cursor_end': cursor_pos,
                'metadata': {},
            }

        msg_id = kc.complete(code_without_header, adjusted_cursor)

        while True:
            try:
                msg = kc.get_shell_msg(timeout=5)
            except Empty:
                break
            if msg['parent_header'].get('msg_id') != msg_id:
                continue
            if msg['msg_type'] == 'complete_reply':
                content = msg['content']
                # Adjust back to original cursor positions
                content['cursor_start'] += adjustment
                content['cursor_end'] += adjustment
                return content

        return {
            'status': 'ok',
            'matches': [],
            'cursor_start': cursor_pos,
            'cursor_end': cursor_pos,
            'metadata': {},
        }

    def do_shutdown(self, restart):
        for entry in self.kernel_map.values():
            try:
                entry['client'].stop_channels()
                entry['manager'].shutdown_kernel(now=True)
            except Exception as e:
                print("Error shutting down subkernel:", e)
        return super().do_shutdown(restart)
