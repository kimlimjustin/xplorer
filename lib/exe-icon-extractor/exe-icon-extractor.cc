#include <node_api.h>
#include <tchar.h>
#include <iostream>
#include <windows.h>
using namespace std;

// Check windows
#if _WIN32 || _WIN64
#if _WIN64
#define ENV64BIT
#else
#define ENV32BIT
#endif
#endif

// Check GCC
#if __GNUC__
#if __x86_64__ || __ppc64__
#define ENV64BIT
#else
#define ENV32BIT
#endif
#endif


typedef struct
{
	WORD idReserved; // must be 0
	WORD idType; // 1 = ICON, 2 = CURSOR
	WORD idCount; // number of images (and ICONDIRs)

	// ICONDIR [1...n]
	// ICONIMAGE [1...n]

} ICONHEADER;

//
// An array of ICONDIRs immediately follow the ICONHEADER
//
typedef struct
{
	BYTE bWidth;
	BYTE bHeight;
	BYTE bColorCount;
	BYTE bReserved;
	WORD wPlanes; // for cursors, this field = wXHotSpot
	WORD wBitCount; // for cursors, this field = wYHotSpot
	DWORD dwBytesInRes;
	DWORD dwImageOffset; // file-offset to the start of ICONIMAGE

} ICONDIR;

//
// After the ICONDIRs follow the ICONIMAGE structures -
// consisting of a BITMAPINFOHEADER, (optional) RGBQUAD array, then
// the color and mask bitmap bits (all packed together
//
typedef struct
{
	BITMAPINFOHEADER biHeader; // header for color bitmap (no mask header)
	//RGBQUAD rgbColors[1...n];
	//BYTE bXOR[1]; // DIB bits for color bitmap
	//BYTE bAND[1]; // DIB bits for mask bitmap

} ICONIMAGE;

//
// Return the number of BYTES the bitmap will take ON DISK
//
static UINT NumBitmapBytes(BITMAP *pBitmap)
{
	int nWidthBytes = pBitmap->bmWidthBytes;

	// bitmap scanlines MUST be a multiple of 4 bytes when stored
	// inside a bitmap resource, so round up if necessary
	if (nWidthBytes & 3)
		nWidthBytes = (nWidthBytes + 4) & ~3;

	return nWidthBytes * pBitmap->bmHeight;
}

static BOOL GetIconBitmapInfo(HICON hIcon, ICONINFO *pIconInfo, BITMAP *pbmpColor, BITMAP *pbmpMask)
{
	if (!GetIconInfo(hIcon, pIconInfo))
		return FALSE;

	if (!GetObject(pIconInfo->hbmColor, sizeof(BITMAP), pbmpColor))
		return FALSE;

	if (!GetObject(pIconInfo->hbmMask, sizeof(BITMAP), pbmpMask))
		return FALSE;

	return TRUE;
}

//
// Write one icon directory entry - specify the index of the image
//
static void WriteIconDirectoryEntry(BYTE* buffer, int* pBufferOffset, int nIdx, HICON hIcon, UINT nImageOffset)
{
	ICONINFO iconInfo;
	ICONDIR iconDir;

	BITMAP bmpColor;
	BITMAP bmpMask;

	UINT nColorCount;
	UINT nImageBytes;

	GetIconBitmapInfo(hIcon, &iconInfo, &bmpColor, &bmpMask);

	nImageBytes = NumBitmapBytes(&bmpColor) + NumBitmapBytes(&bmpMask);

	if (bmpColor.bmBitsPixel >= 8)
		nColorCount = 0;
	else
		nColorCount = 1 << (bmpColor.bmBitsPixel * bmpColor.bmPlanes);

	// Create the ICONDIR structure
	iconDir.bWidth = (BYTE)bmpColor.bmWidth;
	iconDir.bHeight = (BYTE)bmpColor.bmHeight;
	iconDir.bColorCount = nColorCount;
	iconDir.bReserved = 0;
	iconDir.wPlanes = bmpColor.bmPlanes;
	iconDir.wBitCount = bmpColor.bmBitsPixel;
	iconDir.dwBytesInRes = sizeof(BITMAPINFOHEADER) + nImageBytes;
	iconDir.dwImageOffset = nImageOffset;

	// Write to disk
	memcpy(&buffer[*pBufferOffset], &iconDir, sizeof(iconDir));
	(*pBufferOffset) += sizeof(iconDir);

	// Free resources
	DeleteObject(iconInfo.hbmColor);
	DeleteObject(iconInfo.hbmMask);
}

static UINT WriteIconData(BYTE* buffer, int* pBufferOffset, HBITMAP hBitmap)
{
	BITMAP bmp;
	int i;
	BYTE * pIconData;

	UINT nBitmapBytes;

	GetObject(hBitmap, sizeof(BITMAP), &bmp);

	nBitmapBytes = NumBitmapBytes(&bmp);

	pIconData = (BYTE *)malloc(nBitmapBytes);

	GetBitmapBits(hBitmap, nBitmapBytes, pIconData);

	// bitmaps are stored inverted (vertically) when on disk..
	// so write out each line in turn, starting at the bottom + working
	// towards the top of the bitmap. Also, the bitmaps are stored in packed
	// in memory - scanlines are NOT 32bit aligned, just 1-after-the-other
	for (i = bmp.bmHeight - 1; i >= 0; i--)
	{
		memcpy(&buffer[*pBufferOffset], pIconData + (i * bmp.bmWidthBytes), bmp.bmWidthBytes);
		(*pBufferOffset) += bmp.bmWidthBytes;

		// extend to a 32bit boundary (in the file) if necessary
		if (bmp.bmWidthBytes & 3)
		{
			DWORD padding = 0;
			memcpy(&buffer[*pBufferOffset], &padding, 4 - bmp.bmWidthBytes);
			(*pBufferOffset) += 4 - bmp.bmWidthBytes;
		}
	}

	free(pIconData);

	return nBitmapBytes;
}

//
// Create a .ICO file, using the specified array of HICON images
//
BOOL SaveIcon3(HICON hIcon[], int nNumIcons, BYTE* buffer, int* pWritten)
{
	int i;
	int* pImageOffset = (int *)malloc(nNumIcons * sizeof(int));
	int bufferOffset = 0;

	if (hIcon == 0 || nNumIcons < 1)
		return 0;

	//
	// Write the iconheader first of all
	//

	ICONHEADER iconheader;

	// Setup the icon header
	iconheader.idReserved = 0; // Must be 0
	iconheader.idType = 1; // Type 1 = ICON (type 2 = CURSOR)
	iconheader.idCount = nNumIcons; // number of ICONDIRs

	// Write the header to disk
	memcpy(&(buffer[bufferOffset]), &iconheader, sizeof(iconheader));
	bufferOffset += sizeof(iconheader);


	//
	// Leave space for the IconDir entries
	//
	bufferOffset += sizeof(ICONDIR) * nNumIcons;

	//
	// Now write the actual icon images!
	//
	for (i = 0; i < nNumIcons; i++) {
		ICONINFO iconInfo;
		BITMAP bmpColor, bmpMask;

		// GetIconBitmapInfo
		GetIconBitmapInfo(hIcon[i], &iconInfo, &bmpColor, &bmpMask);

		// record the file-offset of the icon image for when we write the icon directories
		pImageOffset[i] = bufferOffset;

		// WriteIconImageHeader

		BITMAPINFOHEADER biHeader;
		UINT nImageBytes;

		// calculate how much space the COLOR and MASK bitmaps take
		nImageBytes = NumBitmapBytes(&bmpColor) + NumBitmapBytes(&bmpMask);

		// write the ICONIMAGE to disk (first the BITMAPINFOHEADER)
		ZeroMemory(&biHeader, sizeof(biHeader));

		// Fill in only those fields that are necessary
		biHeader.biSize = sizeof(biHeader);
		biHeader.biWidth = bmpColor.bmWidth;
		biHeader.biHeight = bmpColor.bmHeight * 2; // height of color+mono
		biHeader.biPlanes = bmpColor.bmPlanes;
		biHeader.biBitCount = bmpColor.bmBitsPixel;
		biHeader.biSizeImage = nImageBytes;

		// write the BITMAPINFOHEADER
		memcpy(&(buffer[bufferOffset]), &biHeader, sizeof(biHeader));
		bufferOffset += sizeof(biHeader);

		// color and mask bitmaps
		WriteIconData(buffer, &bufferOffset, iconInfo.hbmColor);
		WriteIconData(buffer, &bufferOffset, iconInfo.hbmMask);

		DeleteObject(iconInfo.hbmColor);
		DeleteObject(iconInfo.hbmMask);
	}
	*pWritten = bufferOffset;

	//
	// Lastly, skip back and write the icon directories.
	//
	bufferOffset = sizeof(ICONHEADER);
	for (i = 0; i < nNumIcons; i++)
	{
		WriteIconDirectoryEntry(buffer, &bufferOffset, i, hIcon[i], pImageOffset[i]);
	}

	free(pImageOffset);

	return 1;
}

void throwIfNotSuccess(napi_env env, napi_status status, char* msg) {
	if (status != napi_ok) {
		throw napi_throw_error(env, NULL, msg);
	}
}
napi_value extractIcon(napi_env env, napi_callback_info info) {
	try {
		size_t argc = 2;
		napi_value argv[1];
		throwIfNotSuccess(env, napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr), "unable to read arguments");

#ifndef ENV64BIT
		napi_throw_error(env, NULL, "only 64 bit supported");
#endif

		wchar_t path[4096];
		size_t szPath;
		wchar_t type[10];
		size_t szType;

		throwIfNotSuccess(env, napi_get_value_string_utf16(env, argv[0], (char16_t*)path, sizeof(path), &szPath), "unable to read path");
		throwIfNotSuccess(env, napi_get_value_string_utf16(env, argv[1], (char16_t*)type, sizeof(type), &szType), "unable to read type");
    	path[szPath] = 0;
    	type[szType] = 0;

    	// 00 Existence only. 02 Write permission. 04 Read permission. 06 Read and write permission.
    	if (_waccess_s(&path[0], 4) != 0) {
    		napi_throw_error(env, NULL, "The icon is not accesible");
    	}; 

		HICON hIconLarge;
		HICON hIconSmall;

		int extractIcon = ExtractIconExW(path, 0, &hIconLarge, &hIconSmall, 1);
		if (extractIcon <= 0) {
			throw napi_throw_error(env, NULL, "ExtractIconEx failed");
			return 0;
		}

		HICON* target;
		if (szType == 5 && memcmp(type, L"small", sizeof(L"small")) == 0 && hIconSmall != NULL || hIconLarge == NULL && hIconSmall != NULL) {
			target = &hIconSmall;
		}
		else if (szType == 5 && memcmp(type, L"large", sizeof(L"large")) == 0 && hIconLarge != NULL) {
			target = &hIconLarge;
		}
		else {
			throw napi_throw_error(env, NULL, "Unknown icon type (type small or large not found)");
			return 0;
		}

		BYTE buffer[(256*256)*4]; // (256x256) Max Windows Icon Size x 4 bytes (32 bits)
		int written;
		SaveIcon3(target, 1, buffer, &written);

		napi_value result;
		void* dummy;
		throwIfNotSuccess(env, napi_create_buffer_copy(env, written, buffer, &dummy, &result), "unable to create buffer");

		return result;
	}
	catch(napi_status status){
		return 0;
	}
	catch(...) {
		napi_throw_error(env, NULL, "Unknown error");
		return 0;
	}
}
napi_value Init(napi_env env, napi_value exports) {
	napi_value fn;


	// Arguments 2 and 3 are function name and length respectively
	// We will leave them as empty for this example
	throwIfNotSuccess(env, napi_create_function(env, "extractIcon", sizeof("extractIcon"), extractIcon, NULL, &fn),
  	"Unable to wrap native function");

	throwIfNotSuccess(env, napi_set_named_property(env, exports, "extractIcon", fn), "Unable to populate exports");

	return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)