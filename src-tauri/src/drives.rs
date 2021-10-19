extern crate kernel32;
extern crate libc;
use std::fs::{self};
//use std::path::Path;
use std::path::PathBuf;
use std::ffi::CString;
#[tauri::command]
pub fn read_drives() {

    unsafe{
        for mut cur_drl in get_win32_ready_drives(){
            println!("{}", cur_drl);
            let mut mcur_drl = cur_drl.clone();
            let mut cur_path = PathBuf::from(mcur_drl.clone());

            //print root of each logical drive letter 
            let unwrpd_curfspath = fs::metadata(cur_path).unwrap();
            if unwrpd_curfspath.is_dir(){

                for entry in fs::read_dir(mcur_drl).unwrap() {

                        println!("drive {0}", entry.unwrap().path().display());
                }
            }
        }
    }
}

//getting all drive letters 
pub unsafe fn get_win32_ready_drives() -> Vec<String>
{
    let mut logical_drives = Vec::with_capacity(5);
    let mut bitfield =kernel32::GetLogicalDrives();
     let mut drive = 'A';
     let mut rtstr = CString::new("");

     while bitfield != 0 {
           if bitfield & 1 == 1 {

            let strfulldl = drive.to_string() + ":\\";
            let cstrfulldl = CString::new(strfulldl.clone()).unwrap();
            let x = kernel32::GetDriveTypeA(cstrfulldl.as_ptr());
            if x ==3 || x ==2
            {
                  logical_drives.push(strfulldl);
                  // println!("drive {0} is {1}", strfdl, x);
            }
           }
           drive = std::char::from_u32((drive as u32) + 1).unwrap();
                   bitfield >>= 1;
       }
    logical_drives
}