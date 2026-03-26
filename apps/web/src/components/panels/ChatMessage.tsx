// Re-export real ChatMessage components — their @/ imports resolve to web/src/ mocks
export {
  MessageBubble,
  ToolCallItem,
  ToolCallsList,
  ActivePlanDisplay,
  PendingApprovalCard,
  StreamingMessage,
  LoadingIndicator,
  EmptyState,
  getToolIcon,
  getToolStatusColor,
  summarizeToolInput,
} from '@client/components/panels/ChatMessage';
