pub mod console;
use console::InspectorClient;
use v8::inspector::{StringView, V8Inspector};

/// Execute script under v8 context
pub async fn execute_script(js_script: String) -> String {
    let isolate = &mut v8::Isolate::new(Default::default());

    let mut client = InspectorClient::new();
    let mut inspector = V8Inspector::create(isolate, &mut client);

    let scope = &mut v8::HandleScope::new(isolate);
    let context = v8::Context::new(scope);
    let scope = &mut v8::ContextScope::new(scope, context);
    inspector.context_created(context, 1, StringView::empty());

    set_globals(&context, scope);

    let code = v8::String::new(scope, &js_script).unwrap();

    let script = v8::Script::compile(scope, code, None).unwrap();
    let result = script.run(scope).unwrap();
    let result = result.to_string(scope).unwrap();
    result.to_rust_string_lossy(scope)
}

pub fn set_globals(
    context: &v8::Local<v8::Context>,
    scope: &mut v8::ContextScope<v8::HandleScope>,
) {
    let global = context.global(scope);

    pub fn alert(
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        _rv: v8::ReturnValue,
    ) {
        if args.length() > 0 {
            let data = args.get(0);
            let data = data.to_string(scope).unwrap();
            let data = data.to_rust_string_lossy(scope);

            println!("[ALERT] {}", data);
            unsafe {
                crate::TAURI_WINDOW
                    .clone()
                    .unwrap()
                    .emit("alert", data)
                    .unwrap();
            }
        }
    }

    macro_rules! set_func {
        ($name:expr, $callback:expr) => {{
            let fn_template = v8::FunctionTemplate::new(scope, $callback);
            let func = fn_template
                .get_function(scope)
                .expect("Unable to create function");
            let key = v8::String::new(scope, $name).unwrap();
            global.set(scope, key.into(), func.into());
        }};
    }

    set_func!("alert", alert);
}

pub async fn init_functions_extension() {
    // TODO: Read and run installed functions extensio
}
