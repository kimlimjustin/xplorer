/* Check hidden file on windows program */

#include <iostream>
#include <string>
#include <windows.h>
#include <filesystem>
#include <dirent.h>

using namespace std;

bool CheckHiddenFile(string const& FilePath){
    DWORD const result = GetFileAttributesA(FilePath.c_str());
    if (result != 0xFFFFFFFF){
        return !!(result & FILE_ATTRIBUTE_HIDDEN);
    }else{
        return false;
    }
}

bool CheckIsDir(string const& FilePath){
    DWORD const result = GetFileAttributesA(FilePath.c_str());
    if (result != 0xFFFFFFFF){
        return !!(result & FILE_ATTRIBUTE_DIRECTORY);
    }else{
        return false;
    }
}

int main(int argc, char** argv){
    cout << "File Name | Is Hidden | Is Directory" << endl;
    DIR *dir;
    struct dirent *ent;
    for (int i = 2; i < argc; i++)
    {
        strcat(argv[1], " ");
        strcat(argv[1], argv[i]);
    }
    if ((dir = opendir (argv[1])) != NULL) {
    /* print all the files and directories within directory */
    while ((ent = readdir (dir)) != NULL) {
        string path = argv[1] + string(ent->d_name);
        cout << ent->d_name << " | " << CheckHiddenFile(path) << " | " << CheckIsDir(path) << endl;
    }
    closedir (dir);
    } else {
    /* could not open directory */
    perror ("");
    return EXIT_FAILURE;
    }
    return 0;
}