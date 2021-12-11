import { AppActionBase } from "./actions";

export interface IClipboardState {
  text: string
}

export const WRITE_TO_CLIPBOARD = 'WRITE_TO_CLIPBOARD';
export const READ_FROM_CLIPBOARD = 'READ_FROM_CLIPBOARD';

export type WriteToClipboardRequest = AppActionBase<typeof WRITE_TO_CLIPBOARD, 'REQUEST'> & { text: string };
export type WriteToClipboardSuccess = AppActionBase<typeof WRITE_TO_CLIPBOARD, 'SUCCESS'> & { text: string };
export type WriteToClipboardFailure = AppActionBase<typeof WRITE_TO_CLIPBOARD, 'FAILURE'> & { message: string };

export type ReadFromClipboardRequest = AppActionBase<typeof READ_FROM_CLIPBOARD, 'REQUEST'> & {};
export type ReadFromClipboardSuccess = AppActionBase<typeof READ_FROM_CLIPBOARD, 'SUCCESS'> & { text: string };
export type ReadFromClipboardFailure = AppActionBase<typeof READ_FROM_CLIPBOARD, 'FAILURE'> & { message: string };

export type ClipboardActions = WriteToClipboardRequest | WriteToClipboardSuccess | WriteToClipboardFailure
  | ReadFromClipboardRequest | ReadFromClipboardSuccess | ReadFromClipboardFailure;

export type ClipboardActionTypes = typeof WRITE_TO_CLIPBOARD | typeof READ_FROM_CLIPBOARD;
