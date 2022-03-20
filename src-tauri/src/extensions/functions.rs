pub mod console;
use crate::extensions::ARGS_STRUCT;
use console::InspectorClient;
use std::sync::mpsc::channel;
use std::thread;
use v8::inspector::{StringView, V8Inspector};

#[derive(serde::Serialize, Clone)]
pub struct ExtensionMessage {
    message_type: String,
    message: serde_json::Value,
}

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
    // let global = context.global(scope);

    // let deno_key = v8::String::new(scope, "myApp").unwrap();
    // let deno_val = v8::Object::new(scope);
    // global.set(scope, deno_key.into(), deno_val.into());
    // let core_key = v8::String::new(scope, "core").unwrap();
    // let core_val = v8::Object::new(scope);
    // deno_val.set(scope, core_key.into(), core_val.into());
    // let hello_key = v8::String::new(scope, "hello").unwrap();
    // let hi_key = v8::String::new(scope, "hi").unwrap();
    // core_val.set(scope, hello_key.into(), hi_key.into());

    let code = v8::String::new(scope, &js_script).unwrap();

    let script = v8::Script::compile(scope, code, None).unwrap();
    let result = script.run(scope).unwrap();
    let result = result.to_string(scope).unwrap();
    result.to_rust_string_lossy(scope)
}

fn throw_type_error(scope: &mut v8::HandleScope, message: impl AsRef<str>) {
    let message = v8::String::new(scope, message.as_ref()).unwrap();
    let exception = v8::Exception::type_error(scope, message);
    scope.throw_exception(exception);
}

fn arg0_to_cb(
    scope: &mut v8::HandleScope,
    args: v8::FunctionCallbackArguments,
) -> Result<v8::Global<v8::Function>, ()> {
    v8::Local::<v8::Function>::try_from(args.get(0))
        .map(|cb| v8::Global::new(scope, cb))
        .map_err(|err| throw_type_error(scope, err.to_string()))
}

pub static mut CALLBACK: Option<v8::Global<v8::Function>> = None;

pub fn set_globals(
    context: &v8::Local<v8::Context>,
    scope: &mut v8::ContextScope<v8::HandleScope>,
) {
    let global = context.global(scope);

    pub fn cb(
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        _rv: v8::ReturnValue,
    ) {
        if let Ok(new) = arg0_to_cb(scope, args) {
            unsafe {
                CALLBACK = Some(new);
            }
            unsafe {
                let (tx, rx) = channel();
                let tx = std::sync::Arc::new(std::sync::Mutex::new(tx));
                crate::TAURI_WINDOW
                    .clone()
                    .unwrap()
                    .listen("hei", move |_| {
                        let tx = tx.clone();
                        thread::spawn(move || {
                            tx.lock().unwrap().send("Clicked").unwrap();
                        });
                    });
                while let Ok(msg) = rx.recv() {
                    let callback = CALLBACK.clone().unwrap();
                    let callback_fn = callback.open(scope);
                    let tc_scope = &mut v8::TryCatch::new(scope);
                    let this = v8::undefined(tc_scope).into();
                    let text = v8::String::new(tc_scope, &msg).unwrap();
                    callback_fn.call(tc_scope, this, &[text.into()]);
                }
            }
        }
    }

    pub fn contextmenu_addmenu(
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        _rv: v8::ReturnValue,
    ) {
        if args.length() > 0 {
            let data = args.get(0);
            let data: serde_json::Value = serde_v8::from_v8(scope, data).unwrap();
            unsafe {
                crate::TAURI_WINDOW
                    .clone()
                    .unwrap()
                    .emit(
                        "extensions",
                        ExtensionMessage {
                            message_type: "contextmenu_addmenu".to_string(),
                            message: data,
                        },
                    )
                    .unwrap();
            }
        }
    }

    pub fn contextmenu_addgroupmenu(
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,
        _rv: v8::ReturnValue,
    ) {
        if args.length() > 0 {
            let data = args.get(0);
            let data: serde_json::Value = serde_v8::from_v8(scope, data).unwrap();
            println!("{:?}", data);
            unsafe {
                crate::TAURI_WINDOW
                    .clone()
                    .unwrap()
                    .emit(
                        "extensions",
                        ExtensionMessage {
                            message_type: "contextmenu_addgroupmenu".to_string(),
                            message: data,
                        },
                    )
                    .unwrap();
            }
        }
    }

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
    set_func!("cb", cb);
    set_func!("contextmenu_addmenu", contextmenu_addmenu);
    set_func!("contextmenu_addgroupmenu", contextmenu_addgroupmenu);
}

pub async fn init_functions_extension() {
    match ARGS_STRUCT.value_of("extension") {
        Some(extension) => {
            println!("{:?}", extension);
        }
        _ => {}
    }
}
