use v8::inspector::*;
pub struct InspectorClient(V8InspectorClientBase);

#[derive(Clone, serde::Serialize)]
pub struct ConsoleMessage<'a> {
    message: &'a str,
    level: i32,
}

impl InspectorClient {
    pub fn new() -> Self {
        Self(V8InspectorClientBase::new::<Self>())
    }
}

impl V8InspectorClientImpl for InspectorClient {
    fn base(&self) -> &V8InspectorClientBase {
        &self.0
    }

    fn base_mut(&mut self) -> &mut V8InspectorClientBase {
        &mut self.0
    }

    fn console_api_message(
        &mut self,
        context_group_id: i32,
        level: i32,
        message: &StringView,
        _url: &StringView,
        _line_number: u32,
        _column_number: u32,
        _stack_trace: &mut V8StackTrace,
    ) {
        println!(
            "*** context_group_id={}, level={}, message={}",
            context_group_id, level, message
        );
        unsafe {
            crate::TAURI_WINDOW
                .clone()
                .unwrap()
                .emit(
                    "console",
                    ConsoleMessage {
                        message: &String::from_utf16_lossy(
                            message.into_iter().collect::<Vec<u16>>().as_slice(),
                        ),
                        level: level,
                    },
                )
                .unwrap();
        }
    }
}
