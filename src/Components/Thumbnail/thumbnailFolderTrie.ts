import ThumbnailFolderNode from './thumbnailFolderNode';

class ThumbnailFolderTrie {
	public _root: ThumbnailFolderNode;

	constructor() {
		this._root = new ThumbnailFolderNode('');
	}

	insert(suffix: string, icon: string): void {
		let node = this._root;
		for (let i = 0; i < suffix.length; i++) {
			let position = 0;
			for (const child of node._children) {
				if (child._ch === suffix[i]) break;
				position++;
			}
			if (position < node._children.length) {
				//find it
				node = node._children[position];
			} else {
				//not find, create new Node
				node._children.push(new ThumbnailFolderNode(suffix[i]));
				node = node._children[position];
			}
		}
		node._isLeaf = true;
		node._icon = icon;
	}

	search(suffix: string): string {
		let node = this._root;
		for (let i = 0; i < suffix.length; i++) {
			for (const child of node._children) {
				if (child._ch === suffix[i]) {
					node = child;
				}
			}
		}
		if (node._isLeaf) return node._icon;
		return null;
	}
}

export default ThumbnailFolderTrie;
