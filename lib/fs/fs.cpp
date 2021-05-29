/* Check hidden file on windows program */

#include <iostream>
#include <string>
#include <windows.h>
#include <filesystem>
#include <dirent.h>
#include <sys/stat.h>
#include <ctime>

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

bool CheckIsSystemFile(string const& FilePath){
    DWORD const result = GetFileAttributesA(FilePath.c_str());
    if (result != 0xFFFFFFFF){
        return !!(result & FILE_ATTRIBUTE_SYSTEM);
    }else{
        return false;
    }
}

int main(int argc, char** argv){
    cout << "File Name | Is Hidden | Is Directory | Is System Protected File | File Size | Created date | Modified date | Accessed date" << endl;
    DIR *dir;
    struct dirent *ent;
    for (int i = 2; i < argc; i++)
    {
        strcat(argv[1], " ");
        strcat(argv[1], argv[i]);
    }
    if ((dir = opendir (argv[1])) != NULL) {
        /* print all the files and directories within directory into stdout */
        while ((ent = readdir (dir)) != NULL) {
            string path = argv[1] + string(ent->d_name);

            struct stat fileInfo;
            stat(path.c_str(), &fileInfo);

            struct tm * created_timeinfo;
            char created_buffer [80];
            created_timeinfo = localtime(&fileInfo.st_ctime);
            strftime(created_buffer, 80, "%d/%m/%Y %H:%M:%S", created_timeinfo);

            struct tm * modified_timeinfo;
            char modified_buffer [80];
            modified_timeinfo = localtime(&fileInfo.st_mtime);
            strftime(modified_buffer, 80, "%d/%m/%Y %H:%M:%S", modified_timeinfo);

            struct tm * accessed_timeinfo;
            char accessed_buffer [80];
            accessed_timeinfo = localtime(&fileInfo.st_atime);
            strftime(accessed_buffer, 80, "%d/%m/%Y %H:%M:%S", accessed_timeinfo);

            cout
                << ent->d_name << " | "
                << CheckHiddenFile(path) << " | "
                << CheckIsDir(path) << " | "
                << CheckIsSystemFile(path) << " | "
                << fileInfo.st_size << " | "
                << created_buffer << " | "
                << modified_buffer << " | "
                << accessed_buffer
            << endl;
        }
        closedir (dir);
    } else {
        /* could not open directory */
        perror ("");
        return EXIT_FAILURE;
    }
    return 0;
}