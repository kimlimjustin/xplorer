/** A module for converting Microsoft Word .docx files to HTML or text. */
declare module 'mammoth' {
	type Input = {
		/** The path to the .docx file. */
		path?: string;

		/** The buffer containing the .docx file, if path is not specified. */
		buffer?: Buffer;
	};

	/** Conversion options. */
	type Options = {
		/**
		 *  Overrides for the default style map.
		 *  Examples:
		 *      "b => em"
		 *      "i => strong"
		 */
		styleMap?: string[];

		/** To stop using the default style map. */
		includeDefaultStyleMap?: boolean;

		convertImage?: unknown;
	};

	/** The error or warning message returned from the processing operation. */
	type Message = {
		/** a string representing the type of the message, such as "warning" or "error" */
		type: 'warning' | 'error';

		/** a string containing the actual message */
		message: string;

		/** the thrown exception that caused this message, if any */
		error?: Error;
	};

	/** The result from the processing operation. */
	type Result = {
		/** The HTML result. */
		value: string;

		/** Error and warning messages if any. */
		messages: Message[];
	};

	namespace images {
		type Image = {
			read(type: string): Promise<Buffer>;
			contentType: string;
		};

		type Source = {
			src: string;
		};

		export function imgElement(
			callback: (image: Image) => Source | Promise<Source>
		): void;
	}

	/**
	 * Converts an existing .docx file to HTML.
	 * @param input An object containing the path or buffer.
	 */
	export function convertToHtml(
		input: Input,
		options?: Options
	): Promise<Result>;

	/**
	 * Converts an existing .docx file to plain texts.
	 * @param input An object containing the path or buffer.
	 */
	export function extractRawText(input: Input): Promise<Result>;
}
