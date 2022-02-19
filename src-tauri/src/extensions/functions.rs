pub mod console;
use console::InspectorClient;
use v8::inspector::{StringView, V8Inspector};

/// Execute script under v8 context
pub async fn execute_script(js_script: String) -> String {
  let platform = v8::new_default_platform(0, false).make_shared();
  v8::V8::initialize_platform(platform);
  v8::V8::initialize();

  let isolate = &mut v8::Isolate::new(Default::default());

  let mut client = InspectorClient::new();
  let mut inspector = V8Inspector::create(isolate, &mut client);

  let scope = &mut v8::HandleScope::new(isolate);
  let context = v8::Context::new(scope);
  let scope = &mut v8::ContextScope::new(scope, context);
  inspector.context_created(context, 1, StringView::empty());

  let code = v8::String::new(scope, &js_script).unwrap();

  let script = v8::Script::compile(scope, code, None).unwrap();
  let result = script.run(scope).unwrap();
  let result = result.to_string(scope).unwrap();
  result.to_rust_string_lossy(scope)
}

pub async fn init_functions_extension() {
  // TODO: Read and run installed functions extensions
}
