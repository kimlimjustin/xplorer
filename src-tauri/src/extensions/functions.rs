pub mod console;
use crate::{extensions::ARGS_STRUCT, utils::generate_string};
use console::InspectorClient;
use std::sync::mpsc::channel;
use v8::{inspector::{StringView, V8Inspector}, Function};
use std::ptr::NonNull;
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

    let code = v8::String::new(scope, &js_script).unwrap();

    let script = v8::Script::compile(scope, code, None).unwrap();
    let result = script.run(scope).unwrap();
    let result = result.to_string(scope).unwrap();


        unsafe{
            let (tx, rx) = channel();
            // let tx = std::sync::Arc::new(std::sync::Mutex::new(tx));
            crate::TAURI_WINDOW
                .clone()
                .unwrap()
                .listen("call_callback", move |e| {
                    let payload = e.payload().unwrap();
                    let payload : serde_json::Value = serde_json::from_str(payload).unwrap();
                    let key = payload["key"].as_str().unwrap().to_string();
                    let tx = tx.clone();
                    tx.send(key).unwrap();
                });
             while let Ok(cb_name) = rx.recv() {
                    
                    // get the callback from the vector
                    let cb_item =  CALLBACKS_REV.iter().find(|(name, _)| name == &cb_name).unwrap();
                    let cb_ptr_bytes = cb_item.1;
                    let cb = v8::Global::<v8::Function>::from_raw(scope, cb_ptr_bytes);
                    // Convert Global to Local
                    let cb_fn = v8::Local::<v8::Function>::new(scope, cb.clone());
                    // Call the callback
                    let tc_scope = &mut v8::TryCatch::new(scope);
                    let this = v8::undefined(tc_scope).into();
                    let text = v8::String::new(tc_scope, "").unwrap();
                    cb_fn.call(tc_scope, this, &[text.into()]).unwrap();

                    // remove the callback from the vector
                    CALLBACKS_REV.retain(|(name, _)| name != &cb_name);
                    
                    // save the callback pointer in the vector
                    let cb_ptr = cb.into_raw();
                    CALLBACKS_REV.push((cb_name, cb_ptr));
                }
        };

    
    result.to_rust_string_lossy(scope)
}

fn throw_type_error(scope: &mut v8::HandleScope, message: impl AsRef<str>) {
    let message = v8::String::new(scope, message.as_ref()).unwrap();
    let exception = v8::Exception::type_error(scope, message);
    scope.throw_exception(exception);
}

fn arg_to_cb(
    scope: &mut v8::HandleScope,
    args: &v8::FunctionCallbackArguments,
    index: i32,
) -> Result<v8::Global<v8::Function>, ()> {
    v8::Local::<v8::Function>::try_from(args.get(index))
        .map(|cb| v8::Global::new(scope, cb))
        .map_err(|err| throw_type_error(scope, err.to_string()))
}

// hashmap to store callback raw pointers
pub static mut CALLBACKS_REV : Vec<(String, NonNull<Function>)> = Vec::new();

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
        if let Ok(new) = arg_to_cb(scope, &args, 0) {
            unsafe {
                // save the callback pointer in the vector
                let cb_name = "cb".to_string();
                let cb_ptr = new.into_raw();
                CALLBACKS_REV.push((cb_name, cb_ptr));
            }
        }
    }

    pub fn contextmenu_addmenu(
        scope: &mut v8::HandleScope,
        args: v8::FunctionCallbackArguments,

        _rv: v8::ReturnValue,
    ) {
        if args.length() > 0 {
            let menu_data = args.get(0);
            let mut menu_data:serde_json::Value = serde_v8::from_v8(scope, menu_data).unwrap();
            if let Ok(cb) = arg_to_cb(scope, &args, 1) {
                let cb_key = generate_string(10);
                menu_data.as_object_mut().unwrap()["role"] = serde_json::json!(format!("__TAURI__.event.emit(\"call_callback\", {{\"key\": \"{}\"}})", cb_key));
                unsafe {
                    // save the callback pointer in the vector
                    let cb_ptr = cb.into_raw();
                    CALLBACKS_REV.push((cb_key.clone(), cb_ptr));
                    crate::TAURI_WINDOW
                        .clone()
                        .unwrap()
                        .emit(
                            "extensions",
                            ExtensionMessage {
                                message_type: "contextmenu_addmenu".to_string(),
                                message: menu_data,
                            },
                        )
                        .unwrap();
                }
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
            let mut data: serde_json::Value = serde_v8::from_v8(scope, data).unwrap();
            for idx in 0..data.as_array_mut().unwrap().len() {
                let callback = arg_to_cb(scope, &args, (idx + 1).try_into().unwrap()).unwrap();
                let callback_key = generate_string(10);
                unsafe{
                    // save the callback pointer in the vector
                    let cb_ptr = callback.into_raw();
                    CALLBACKS_REV.push((callback_key.clone(), cb_ptr));
                }
                data.as_array_mut().unwrap()[idx]["role"] = serde_json::json!(format!("__TAURI__.event.emit(\"call_callback\", {{\"key\": \"{}\"}})", callback_key));
            }
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


    pub fn edit_infobar_value(scope: &mut v8::HandleScope, args: v8::FunctionCallbackArguments, _rv: v8::ReturnValue) {
        if args.length() > 0 {
            let infobar_key = args.get(0);
            let infobar_key = infobar_key.to_string(scope).unwrap();
            let infobar_key = infobar_key.to_rust_string_lossy(scope);
            let new_value = args.get(1);
            let new_value = new_value.to_string(scope).unwrap();
            let new_value = new_value.to_rust_string_lossy(scope);
            let data = serde_json::json!({
                "infobar_key": infobar_key,
                "new_value": new_value,
            });

            unsafe {
                crate::TAURI_WINDOW
                    .clone()
                    .unwrap()
                    .emit("infobar", data)
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
    set_func!("edit_infobar_value", edit_infobar_value);
}

pub async fn init_functions_extension() {
    match ARGS_STRUCT.value_of("extension") {
        Some(extension) => {
            println!("{:?}", extension);
        }
        _ => {}
    }
}
