use super::*;
#[cfg(windows)]
use windows::Win32::Foundation::{WPARAM,LRESULT};
const WINDOW:&str="desktop-assistant";
struct Companion{child:Child,input:Arc<Mutex<ChildStdin>>,snapshot:Value}
static COMPANION:Mutex<Option<Companion>>=Mutex::new(None);
static TEST_BUSY:AtomicBool=AtomicBool::new(false);
struct TestGuard;
impl Drop for TestGuard{fn drop(&mut self){TEST_BUSY.store(false,Ordering::SeqCst);}}

#[cfg(windows)]
const OVERLAY_SUBCLASS:usize=0x53594E43;

#[cfg(windows)]
unsafe extern "system" fn overlay_frame_proc(hwnd:HWND,message:u32,wparam:WPARAM,lparam:LPARAM,id:usize,_data:usize)->LRESULT{
    use windows::Win32::UI::Shell::{DefSubclassProc,RemoveWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{WM_NCPAINT,WM_NCACTIVATE,WM_NCDESTROY};
    match message{
        // Keep focus notifications flowing to Tao/WebView, but tell the default
        // procedure not to paint the inactive/active system-window frame.
        WM_NCPAINT=>LRESULT(0),
        WM_NCACTIVATE=>DefSubclassProc(hwnd,message,wparam,LPARAM(-1)),
        WM_NCDESTROY=>{let _=RemoveWindowSubclass(hwnd,Some(overlay_frame_proc),id);DefSubclassProc(hwnd,message,wparam,lparam)},
        _=>DefSubclassProc(hwnd,message,wparam,lparam),
    }
}

fn install_overlay_frame_guard(window:&tauri::WebviewWindow){
    #[cfg(windows)]{
        // Windows requires subclass installation on the window's owner thread.
        let target=window.clone();
        let _=window.run_on_main_thread(move||{
            if let Ok(raw)=target.hwnd(){unsafe{
                let _=windows::Win32::UI::Shell::SetWindowSubclass(HWND(raw.0 as _),Some(overlay_frame_proc),OVERLAY_SUBCLASS,0);
            }}
            prepare_overlay(&target);
        });
    }
}

#[cfg(all(test,windows))]
mod overlay_frame_tests{
    use super::*;
    use windows::Win32::Foundation::HINSTANCE;
    use windows::Win32::UI::Shell::{DefSubclassProc,RemoveWindowSubclass,SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{CreateWindowExW,DestroyWindow,SendMessageW,HMENU,WINDOW_EX_STYLE,WS_POPUP,WM_NCPAINT,WM_NCACTIVATE,WM_NCDESTROY,WM_SETFOCUS,WM_KILLFOCUS};
    #[derive(Default)]
    struct Probe{paints:usize,activations:usize,focus:usize,last_activation: isize}
    unsafe extern "system" fn observe(hwnd:HWND,msg:u32,wp:WPARAM,lp:LPARAM,id:usize,data:usize)->LRESULT{
        let probe=&mut *(data as *mut Probe);
        match msg{
            WM_NCPAINT=>{probe.paints+=1;LRESULT(99)},
            WM_NCACTIVATE=>{probe.activations+=1;probe.last_activation=lp.0;LRESULT(1)},
            WM_SETFOCUS|WM_KILLFOCUS=>{probe.focus+=1;DefSubclassProc(hwnd,msg,wp,lp)},
            WM_NCDESTROY=>{let _=RemoveWindowSubclass(hwnd,Some(observe),id);DefSubclassProc(hwnd,msg,wp,lp)},
            _=>DefSubclassProc(hwnd,msg,wp,lp),
        }
    }
    struct TestWindow(HWND);
    impl Drop for TestWindow{fn drop(&mut self){unsafe{let _=DestroyWindow(self.0);}}}
    #[test]
    fn suppresses_system_frame_when_focus_changes_without_swallowing_focus(){unsafe{
        let mut probe=Probe::default();
        let window=TestWindow(CreateWindowExW(WINDOW_EX_STYLE::default(),windows::core::w!("STATIC"),windows::core::w!("Sync frame regression"),WS_POPUP,0,0,120,64,HWND::default(),HMENU::default(),HINSTANCE::default(),None).unwrap());
        assert!(SetWindowSubclass(window.0,Some(observe),2,(&mut probe as *mut Probe)as usize).as_bool());
        assert!(SetWindowSubclass(window.0,Some(overlay_frame_proc),OVERLAY_SUBCLASS,0).as_bool());
        for active in [true,false,true,false]{
            SendMessageW(window.0,WM_NCACTIVATE,WPARAM(active as usize),LPARAM(0));
            assert_eq!(SendMessageW(window.0,WM_NCPAINT,WPARAM(1),LPARAM(0)),LRESULT(0));
        }
        SendMessageW(window.0,WM_SETFOCUS,WPARAM(0),LPARAM(0));
        SendMessageW(window.0,WM_KILLFOCUS,WPARAM(0),LPARAM(0));
        assert_eq!(probe.paints,0);
        assert_eq!(probe.activations,4);
        assert_eq!(probe.last_activation,-1);
        assert_eq!(probe.focus,2);
    }}
}

fn send(input:&Arc<Mutex<ChildStdin>>,packet:&Value)->Result<(),String>{
    let mut writer=input.lock().map_err(|_|"Canal do assistente indisponível")?;
    writeln!(writer,"{packet}").and_then(|_|writer.flush()).map_err(|error|error.to_string())
}

fn prepare_overlay(window:&tauri::WebviewWindow){
    #[cfg(windows)]{
        use windows::Win32::UI::WindowsAndMessaging::{GetWindowLongPtrW,SetWindowLongPtrW,SetWindowPos,
            GWL_STYLE,GWL_EXSTYLE,WS_CAPTION,WS_THICKFRAME,WS_BORDER,WS_DLGFRAME,WS_SYSMENU,
            WS_MINIMIZEBOX,WS_MAXIMIZEBOX,WS_POPUP,WS_EX_APPWINDOW,WS_EX_WINDOWEDGE,
            WS_EX_CLIENTEDGE,WS_EX_DLGMODALFRAME,WS_EX_STATICEDGE,WS_EX_TOOLWINDOW,
            SWP_FRAMECHANGED,SWP_NOACTIVATE,SWP_NOMOVE,SWP_NOSIZE,SWP_NOZORDER,SWP_NOOWNERZORDER};
        if let Ok(raw)=window.hwnd(){unsafe{
            let hwnd=HWND(raw.0 as _);
            use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute,DWMWA_NCRENDERING_POLICY,DWMNCRP_DISABLED,DWMWA_BORDER_COLOR,DWMWA_WINDOW_CORNER_PREFERENCE,DWMWCP_DONOTROUND};
            let policy=DWMNCRP_DISABLED.0;
            let border_none=0xfffffffe_u32;
            let corners=DWMWCP_DONOTROUND.0;
            let _=DwmSetWindowAttribute(hwnd,DWMWA_NCRENDERING_POLICY,(&policy as *const i32).cast(),std::mem::size_of_val(&policy)as u32);
            let _=DwmSetWindowAttribute(hwnd,DWMWA_BORDER_COLOR,(&border_none as *const u32).cast(),std::mem::size_of_val(&border_none)as u32);
            let _=DwmSetWindowAttribute(hwnd,DWMWA_WINDOW_CORNER_PREFERENCE,(&corners as *const i32).cast(),std::mem::size_of_val(&corners)as u32);
            // Tao hides the caption through non-client handling but can retain
            // its native style bits. Region redraws then briefly paint a classic frame.
            let style=GetWindowLongPtrW(hwnd,GWL_STYLE)as u32;
            let clean=(style&!(WS_CAPTION.0|WS_THICKFRAME.0|WS_BORDER.0|WS_DLGFRAME.0|WS_SYSMENU.0|WS_MINIMIZEBOX.0|WS_MAXIMIZEBOX.0))|WS_POPUP.0;
            let extended=GetWindowLongPtrW(hwnd,GWL_EXSTYLE)as u32;
            let clean_extended=(extended&!(WS_EX_APPWINDOW.0|WS_EX_WINDOWEDGE.0|WS_EX_CLIENTEDGE.0|WS_EX_DLGMODALFRAME.0|WS_EX_STATICEDGE.0))|WS_EX_TOOLWINDOW.0;
            if style!=clean||extended!=clean_extended{
                SetWindowLongPtrW(hwnd,GWL_STYLE,clean as isize);
                SetWindowLongPtrW(hwnd,GWL_EXSTYLE,clean_extended as isize);
                let _=SetWindowPos(hwnd,HWND::default(),0,0,0,0,SWP_FRAMECHANGED|SWP_NOACTIVATE|SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_NOOWNERZORDER);
            }
        }}
    }
}

fn set_overlay_visible(window:&tauri::WebviewWindow,visible:bool){
    #[cfg(windows)]{
        use windows::Win32::UI::WindowsAndMessaging::{ShowWindow,IsWindowVisible,SW_SHOWNOACTIVATE,SW_HIDE};
        if let Ok(raw)=window.hwnd(){unsafe{
            // Tao's show/hide flag updates reconstruct WS_CAPTION. Keep these
            // overlays entirely frameless instead of restoring that cached style.
            if visible{prepare_overlay(window);}
            let hwnd=HWND(raw.0 as _);
            if IsWindowVisible(hwnd).as_bool()!=visible{let _=ShowWindow(hwnd,if visible{SW_SHOWNOACTIVATE}else{SW_HIDE});}
        }return;}
    }
    if visible{let _=window.show();}else{let _=window.hide();}
}

fn create_window(app:&AppHandle)->Result<tauri::WebviewWindow,String>{
    if let Some(window)=app.get_webview_window(WINDOW){return Ok(window);}
    let window=tauri::WebviewWindowBuilder::new(app,WINDOW,tauri::WebviewUrl::App("desktop-assistant.html".into()))
        .title("itsflow Assistente").inner_size(420.,740.).decorations(false).transparent(true)
        .background_color(tauri::webview::Color(0,0,0,0)).always_on_top(true).skip_taskbar(true)
        .resizable(false).shadow(false).focused(false).visible(false).build().map_err(|error|error.to_string())?;
    install_overlay_frame_guard(&window);
    prepare_overlay(&window);
    #[cfg(windows)]{
        use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity,WDA_EXCLUDEFROMCAPTURE};
        if let Ok(hwnd)=window.hwnd(){unsafe{let _=SetWindowDisplayAffinity(HWND(hwnd.0 as _),WDA_EXCLUDEFROMCAPTURE);}}
    }
    let closing=window.clone();
    window.on_window_event(move|event|{
        if matches!(event,tauri::WindowEvent::Focused(_)){prepare_overlay(&closing);}
        if let tauri::WindowEvent::CloseRequested{api,..}=event{
        api.prevent_close();hide_surfaces(closing.app_handle());
        if let Ok(guard)=COMPANION.lock(){if let Some(companion)=guard.as_ref(){let _=send(&companion.input,&serde_json::json!({"op":"close"}));}}
    }});
    Ok(window)
}

const AURA_EDGES:[&str;4]=["top","right","bottom","left"];

fn aura_started()->u128{std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()}
fn replay_aura(app:&AppHandle){
    let started=aura_started();
    for edge in AURA_EDGES{if let Some(window)=app.get_webview_window(&format!("assistant-aura-{edge}")){let _=window.eval(&format!("window.startItsflowAura?.({started});"));}}
}

fn hide_surfaces(app:&AppHandle){
    if let Some(window)=app.get_webview_window(WINDOW){set_overlay_visible(&window,false);}
    for edge in AURA_EDGES{if let Some(window)=app.get_webview_window(&format!("assistant-aura-{edge}")){set_overlay_visible(&window,false);}}
}

fn capture_passthrough(app:&AppHandle,capturing:bool){
    if let Some(window)=app.get_webview_window(WINDOW){
        let _=window.set_ignore_cursor_events(capturing);
        prepare_overlay(&window);
    }
}

fn raise_capture_surfaces(app:&AppHandle){
    #[cfg(windows)]{
        use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos,HWND_TOPMOST,SWP_NOACTIVATE,SWP_NOMOVE,SWP_NOSIZE};
        // Tk's full-screen selector is also topmost. Raise our input-transparent
        // overlays after it has painted, keeping selection keyboard focus in Tk.
        for label in AURA_EDGES.iter().map(|edge|format!("assistant-aura-{edge}")).chain(std::iter::once(WINDOW.to_string())){
            if let Some(window)=app.get_webview_window(&label){if let Ok(raw)=window.hwnd(){unsafe{
                let _=SetWindowPos(HWND(raw.0 as _),HWND_TOPMOST,0,0,0,0,SWP_NOACTIVATE|SWP_NOMOVE|SWP_NOSIZE);
            }}}
        }
    }
}

fn layout(app:&AppHandle,open:bool){
    let Some(window)=app.get_webview_window(WINDOW)else{return};
    prepare_overlay(&window);
    let monitor=app.get_webview_window("main").and_then(|main|main.current_monitor().ok().flatten()).or_else(||window.primary_monitor().ok().flatten());
    let Some(monitor)=monitor else{set_overlay_visible(&window,true);return};
    let scale=monitor.scale_factor();let p=monitor.position();let size=monitor.size();
    // Keep the horizontal frame identical in both states. Changing its width
    // before WebView reflow used to displace the centered notch for a frame.
    let width=420.0_f64.min(size.width as f64/scale-16.);
    let height=if open{740.0_f64}else{62.0_f64}.min(size.height as f64/scale-48.);
    let x=p.x as f64+(size.width as f64-width*scale)/2.;
    let target_size=tauri::PhysicalSize::new((width*scale).round()as u32,(height*scale).round()as u32);
    let resized=window.outer_size().ok()!=Some(target_size);
    if resized{let _=window.set_size(target_size);}
    let target_position=tauri::PhysicalPosition::new(x.round()as i32,p.y+6);
    if window.outer_position().ok()!=Some(target_position){let _=window.set_position(target_position);}
    #[cfg(windows)]{
        use windows::Win32::Graphics::Gdi::{CreateRectRgn,DeleteObject,SetWindowRgn,RedrawWindow,RDW_INVALIDATE,RDW_ALLCHILDREN};
        if resized{if let Ok(hwnd)=window.hwnd(){unsafe{
                // Clip both painting and hit-testing to the compact notch;
                // the fixed-width transparent sides must not block desktop tabs.
                let notch_width=if open{target_size.width as i32}else{(218.*scale).round().min(target_size.width as f64)as i32};
                let left=(target_size.width as i32-notch_width)/2;
                let region=CreateRectRgn(left,0,left+notch_width,target_size.height as i32);
                if !region.is_invalid()&&SetWindowRgn(HWND(hwnd.0 as _),region,false)==0{let _=DeleteObject(region);}
                // Repaint the WebView/client only; never request a system-frame repaint.
                let _=RedrawWindow(HWND(hwnd.0 as _),None,None,RDW_INVALIDATE|RDW_ALLCHILDREN);
        }}}
    }
    set_overlay_visible(&window,true);
    show_auras(app,&monitor,"assistant-aura");
}

fn show_auras(app:&AppHandle,monitor:&tauri::Monitor,prefix:&str){
    let scale=monitor.scale_factor();let p=monitor.position();let size=monitor.size();
    // Four narrow, input-transparent surfaces keep the entire desktop usable.
    let thickness=(26.*scale).round()as u32;
    let started=aura_started();
    for edge in AURA_EDGES{
        let label=format!("{prefix}-{edge}");
        let execution=prefix=="execution-aura";
        let aura=if let Some(existing)=app.get_webview_window(&label){Some(existing)}else{
            tauri::WebviewWindowBuilder::new(app,&label,tauri::WebviewUrl::App("assistant-aura.html".into()))
                .title("Sync aura").inner_size(18.,18.).decorations(false).transparent(true)
                .background_color(tauri::webview::Color(0,0,0,0)).always_on_top(true).skip_taskbar(true)
                .resizable(false).shadow(false).focused(false).visible(false)
                .on_page_load(move|webview,payload|{
                    if execution&&matches!(payload.event(),tauri::webview::PageLoadEvent::Finished){
                        let script=if EXECUTION_VISIBLE.load(Ordering::SeqCst){format!("window.startItsflowAura?.({});",aura_started())}else{"window.stopItsflowAura?.();".into()};
                        let _=webview.eval(&script);
                    }
                })
                .initialization_script(format!("window.itsflowAuraEdge='{edge}';window.itsflowAuraStarted={started};"))
                .build().ok().map(|aura|{install_overlay_frame_guard(&aura);aura})
        };
        if let Some(aura)=aura{
            prepare_overlay(&aura);
            // Never show the aura unless click-through is successfully enabled.
            if aura.set_ignore_cursor_events(true).is_err(){set_overlay_visible(&aura,false);continue;}
            #[cfg(windows)]{
                use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity,WDA_EXCLUDEFROMCAPTURE};
                if let Ok(hwnd)=aura.hwnd(){unsafe{let _=SetWindowDisplayAffinity(HWND(hwnd.0 as _),WDA_EXCLUDEFROMCAPTURE);}}
            }
            let (x,y,w,h)=match edge{
                "top"=>(p.x,p.y,size.width,thickness),
                "bottom"=>(p.x,p.y+size.height as i32-thickness as i32,size.width,thickness),
                "left"=>(p.x,p.y,thickness,size.height),
                _=>(p.x+size.width as i32-thickness as i32,p.y,thickness,size.height),
            };
            let _=aura.set_size(tauri::PhysicalSize::new(w,h));
            let _=aura.set_position(tauri::PhysicalPosition::new(x,y));set_overlay_visible(&aura,true);
        }
    }
}

fn valid_assistant_control(op:&str)->bool{
    ["arm","open","collapse","close","explain","retry","edit","confirm","undo","import","refresh","capture","destination","create"].contains(&op)
}

#[cfg(test)]
mod section_control_tests{
    #[test]
    fn section_selection_passes_the_native_command_boundary(){
        assert!(super::valid_assistant_control("destination"));
        assert!(super::valid_assistant_control("confirm"));
        assert!(!super::valid_assistant_control("unknown-control"));
    }
}

#[tauri::command]
pub async fn desktop_assistant_action(app:AppHandle,request:Value)->Result<Value,String>{
    let op=request["op"].as_str().unwrap_or("status");
    if op=="drag"{return Ok(serde_json::json!({"accepted":true}));}
    if op=="test_catalog"||op=="test_block"{
        let (automation,input)={
            let guard=COMPANION.lock().map_err(|_|"Assistente indisponível")?;
            let companion=guard.as_ref().ok_or("Abra o assistente no Studio.")?;
            if companion.snapshot["busy"]==true||companion.snapshot["capturing"]==true{return Err("Aguarde a etapa atual.".into());}
            (companion.snapshot["automation"]["id"].clone(),companion.input.clone())
        };
        let root=workspace_root(&app);
        if op=="test_catalog"{
            return tauri::async_runtime::spawn_blocking(move||run_helper_json(&root,&["map-paths".into(),"--request".into(),serde_json::json!({"action":"demonstration_tests","automation_id":automation}).to_string()])).await.map_err(|e|e.to_string())?;
        }
        if TEST_BUSY.compare_exchange(false,true,Ordering::SeqCst,Ordering::SeqCst).is_err(){return Err("Já existe um teste em andamento.".into());}
        let _test_guard=TestGuard;
        if *app.state::<RuntimeState>().running.lock().map_err(|_|"Execução indisponível")?||get_remote_agent_snapshot(&root)["snapshot"]["running"]==true{return Err("Pare a automação antes de testar um bloco.".into());}
        let mut payload=request.clone();payload["action"]=serde_json::json!("demonstration_tests");payload["automation_id"]=automation;
        if !payload["order"].is_u64()||!payload["revision"].is_string()||!payload["block_id"].is_string(){return Err("Atualize a lista de blocos antes de testar.".into());}
        let folder=root.clone();
        let target=tauri::async_runtime::spawn_blocking(move||run_helper_json(&folder,&["map-paths".into(),"--request".into(),payload.to_string()])).await.map_err(|e|e.to_string())??;
        let mode=request["mode"].as_str().unwrap_or("screen");
        let capability=if mode=="chrome"{"test_chrome"}else if mode=="screen"{"test_screen"}else{return Err("Escolha Tela ou Chrome.".into());};
        if target["block"][capability]!=true{return Err("Este reconhecimento não possui alvo configurado para este tipo de teste.".into());}
        send(&input,&serde_json::json!({"op":"test_begin","order":request["order"]}))?;
        // Fold the panel before looking at the target; keep the passive notch visible.
        let chrome_mode=mode=="chrome";let target_copy=target.clone();
        let result=tauri::async_runtime::spawn_blocking(move||{
            thread::sleep(Duration::from_millis(400));
            if chrome_mode{
                let texts=target_copy["block"]["texts"].as_array().map(|items|items.iter().filter_map(|v|v.as_str().map(str::to_string)).collect()).unwrap_or_default();
                let selector=target_copy["block"]["selector"].as_str().filter(|s|!s.is_empty()).map(str::to_string);
                tauri::async_runtime::block_on(chrome_test_bridge::test_chrome_extension_recognition(texts,selector,None))
            }else{
                // Uses the same read-only worker and highlight as Procurar.
                let _=fs::remove_file(root.join(".parar_automacao.flag"));let (ok,stdout,stderr)=test_image_recognition_worker(&root,target_copy["worker"].clone())?;
                Ok(serde_json::json!({"ok":ok,"log":stdout.chars().take(12000).collect::<String>(),"error":stderr.chars().take(2000).collect::<String>()}))
            }
        }).await.map_err(|e|e.to_string()).and_then(|v|v);
        let mut outcome=match result{Ok(v)=>v,Err(e)=>serde_json::json!({"ok":false,"error":e})};
        outcome["order"]=request["order"].clone();outcome["mode"]=request["mode"].clone();
        outcome["revision"]=target["revision"].clone();
        send(&input,&serde_json::json!({"op":"test_finish","result":outcome}))?;
        return Ok(outcome);
    }
    if op=="upload_workbook"{
        {
            let guard=COMPANION.lock().map_err(|_|"Assistente indisponível")?;
            let companion=guard.as_ref().ok_or("Abra o assistente no Studio.")?;
            if companion.snapshot["busy"]==true || !companion.snapshot["events"].as_array().map(|events|events.iter().any(|e|e["id"]==companion.snapshot["pending"]&&e["kind"]=="manual_sheet")).unwrap_or(false){return Err("Abra a criação de um bloco de planilha antes de enviar.".into());}
        }
        let name=request["file_name"].as_str().ok_or("Informe o nome da planilha.")?;
        let extension=Path::new(name).extension().and_then(|v|v.to_str()).unwrap_or("").to_ascii_lowercase();
        if !["xlsx","xlsm","xltx","xltm"].contains(&extension.as_str()){return Err("Envie uma planilha Excel (.xlsx ou .xlsm).".into());}
        let values=request["bytes"].as_array().ok_or("Arquivo inválido.")?;
        if values.is_empty()||values.len()>25*1024*1024{return Err("Envie uma planilha de até 25 MB.".into());}
        let bytes:Vec<u8>=values.iter().map(|v|v.as_u64().filter(|n|*n<=255).map(|n|n as u8).ok_or("Arquivo inválido.")).collect::<Result<_,_>>()?;
        let unique=format!("sync-{}-{}",std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e|e.to_string())?.as_nanos(),sanitize_workbook_filename(name));
        let handle=app.clone();
        return tauri::async_runtime::spawn_blocking(move||{
            let result=import_workbook(handle.clone(),unique,bytes)?;
            let parsed=(||->Result<Value,String>{
                let metadata=get_workbook_meta(handle.clone())?;
                let workbook=metadata["workbooks"].as_array().and_then(|items|items.iter().find(|item|item["id"]==result["workbook_id"])).cloned().ok_or("Não foi possível ler as abas da planilha.")?;
                if !workbook["sheets"].as_array().map(|items|items.iter().any(|sheet|sheet["columns"].as_array().map(|v|!v.is_empty()).unwrap_or(false))).unwrap_or(false){return Err("Informe os nomes das colunas na primeira linha da planilha.".into());}
                Ok(workbook)
            })();
            if parsed.is_err(){
                let root=workspace_root(&handle);
                if let Some(id)=result["workbook_id"].as_str(){if let Ok(path)=resolve_safe_workbook_path(&root,id){let _=fs::remove_file(path);}}
            }
            parsed
        }).await.map_err(|e|e.to_string())?;
    }
    if op=="map_sections"{
        let handle=app.clone();
        let context=tauri::async_runtime::spawn_blocking(move||chrome_demonstration_request(&handle,serde_json::json!({"operation":"status"}))).await.map_err(|error|error.to_string())??;
        let guard=COMPANION.lock().map_err(|_|"Assistente indisponível")?;
        let companion=guard.as_ref().ok_or("Abra o assistente no Studio.")?;
        if context["automation"]["id"]!=companion.snapshot["automation"]["id"]{return Err("Reabra a automação vinculada a este assistente.".into());}
        send(&companion.input,&serde_json::json!({"op":"map_sections","sections":context["sections"],"revision":context["revision"]}))?;
        return Ok(serde_json::json!({"accepted":true}));
    }
    let guard=COMPANION.lock().map_err(|_|"Assistente indisponível")?;
    let companion=guard.as_ref().ok_or("Abra Demonstrar no desktop no Chat IA do Studio.")?;
    if op=="status"{return Ok(companion.snapshot.clone());}
    if !valid_assistant_control(op){return Err(format!("Controle do assistente inválido: {op}. Reinicie o Studio para carregar a versão atualizada."));}
    send(&companion.input,&request)?;
    if op=="close"{hide_surfaces(&app);}
    Ok(serde_json::json!({"accepted":true}))
}

#[tauri::command]
pub async fn start_desktop_assistant(app:AppHandle)->Result<Value,String>{
    tauri::async_runtime::spawn_blocking(move||start(app)).await.map_err(|error|error.to_string())?
}

fn start(app:AppHandle)->Result<Value,String>{
    let window=create_window(&app)?;
    let mut guard=COMPANION.lock().map_err(|_|"Estado do assistente indisponível")?;
    if let Some(companion)=guard.as_mut(){if companion.snapshot["closed"]!=true&&companion.child.try_wait().map_err(|error|error.to_string())?.is_none(){
        send(&companion.input,&serde_json::json!({"op":"show"}))?;drop(guard);layout(&app,true);replay_aura(&app);return Ok(serde_json::json!({"running":true}));
    }else{let _=companion.child.kill();let _=companion.child.wait();}}
    *guard=None;
    let root=workspace_root(&app);
    if get_remote_agent_snapshot(&root)["snapshot"]["running"]==true{return Err("Pare a execução antes de demonstrar um processo.".into());}
    let status=chrome_demonstration_request(&app,serde_json::json!({"operation":"status"}))?;
    let id=status["automation"]["id"].as_str().filter(|id|!id.is_empty()).ok_or("Abra uma automação para receber a demonstração.")?;
    let script=ensure_python_script_integrity(&root,"desktop_assistant.py")?;
    let _=ensure_python_script_integrity(&root,"capturar_imagem_tela.py")?;
    let (program,args)=python_command_for_visual_feedback(&root)?;
    let sessions=app.path().app_data_dir().map_err(|error|error.to_string())?.join("desktop-demonstrations");
    fs::create_dir_all(&sessions).map_err(|error|error.to_string())?;
    use sha2::{Digest,Sha256};
    let filename=format!("{:x}.json",Sha256::digest(id.as_bytes()));
    let config=serde_json::json!({"automation":status["automation"],"revision":status["revision"],"sections":status["sections"],"studio_pid":std::process::id(),"session_path":sessions.join(filename)});
    let mut command=Command::new(program);
    command.args(args).arg("-u").arg(script).current_dir(&root).env("PYTHONUTF8","1").stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    configure_no_window(&mut command);
    let mut child=command.spawn().map_err(|error|format!("Não foi possível abrir a captura: {error}"))?;
    let mut input=child.stdin.take().ok_or("Canal de entrada indisponível")?;
    writeln!(input,"{config}").and_then(|_|input.flush()).map_err(|error|error.to_string())?;
    let worker_id=child.id();let output=child.stdout.take().ok_or("Canal de saída indisponível")?;let errors=child.stderr.take();
    let input=Arc::new(Mutex::new(input));let writer=input.clone();
    *guard=Some(Companion{child,input,snapshot:serde_json::json!({"open":false,"busy":false,"status":"Preparando seu assistente…","events":[],"messages":[]})});drop(guard);
    layout(&app,false);replay_aura(&app);let _=window.emit("desktop-assistant-reset",serde_json::json!({}));
    if let Some(errors)=errors{let error_app=app.clone();std::thread::spawn(move||{
        for line in BufReader::new(errors).lines().map_while(Result::ok){if !line.trim().is_empty(){let _=error_app.emit("desktop-assistant-error",serde_json::json!({"message":line.chars().take(500).collect::<String>()}));}}
    });}
    std::thread::spawn(move||{
        for line in BufReader::new(output).lines().map_while(Result::ok){
            if !COMPANION.lock().ok().and_then(|state|state.as_ref().map(|companion|companion.child.id()==worker_id)).unwrap_or(false){break;}
            let Ok(packet)=serde_json::from_str::<Value>(&line)else{continue};
            match packet["type"].as_str().unwrap_or(""){
                "state"=>{
                    let snapshot=packet["state"].clone();let open=snapshot["open"]!=false;
                    let changed=if let Ok(mut state)=COMPANION.lock(){if let Some(companion)=state.as_mut(){let changed=companion.snapshot["open"]!=snapshot["open"]||companion.snapshot["capturing"]!=snapshot["capturing"]||companion.snapshot["testing"]!=snapshot["testing"];companion.snapshot=snapshot.clone();changed}else{false}}else{false};
                    if changed{capture_passthrough(&app,snapshot["capturing"]==true||snapshot["testing"]==true);layout(&app,open);}else if let Some(window)=app.get_webview_window(WINDOW){set_overlay_visible(&window,true);}
                    let _=app.emit_to(WINDOW,"desktop-assistant-state",snapshot);
                },
                "hide"|"closed"=>{if packet["type"]=="closed"{if let Ok(mut state)=COMPANION.lock(){if let Some(companion)=state.as_mut(){companion.snapshot["closed"]=serde_json::json!(true);}}}hide_surfaces(&app);},
                "capture-ready"=>{
                    let capturing=COMPANION.lock().ok().and_then(|state|state.as_ref().map(|companion|companion.snapshot["capturing"]==true)).unwrap_or(false);
                    if capturing{raise_capture_surfaces(&app);}
                },
                "captured"=>{capture_passthrough(&app,false);layout(&app,true);},
                "request"=>{
                    let id=packet["request_id"].clone();
                    let result=if line.len()>4*1024*1024{Err("Rascunho muito grande. Divida a demonstração.".into())}else{chrome_demonstration_request(&app,packet)};
                    let response=match result{Ok(result)=>serde_json::json!({"request_id":id,"result":result}),Err(error)=>serde_json::json!({"request_id":id,"error":error})};
                    if send(&writer,&response).is_err(){break;}
                },_=>{}
            }
        }
        let current=if let Ok(mut state)=COMPANION.lock(){
            if let Some(companion)=state.as_mut(){
                if companion.child.id()==worker_id{companion.snapshot["closed"]=serde_json::json!(true);true}else{false}
            }else{false}
        }else{false};
        if current{hide_surfaces(&app);}
    });
    Ok(serde_json::json!({"running":true,"message":"Mini assistente aberto. Demonstre uma ação por vez."}))
}

// Execution uses the same passive surfaces as Sync, with its own lifecycle.
static EXECUTION_APP:OnceLock<AppHandle>=OnceLock::new();
static EXECUTION_QUEUE:OnceLock<std::sync::mpsc::Sender<bool>>=OnceLock::new();
static EXECUTION_VISIBLE:AtomicBool=AtomicBool::new(false);
static EXECUTION_GENERATION:std::sync::atomic::AtomicU64=std::sync::atomic::AtomicU64::new(0);
pub fn init_execution_surface(app:AppHandle){
    if EXECUTION_APP.set(app.clone()).is_err(){return;}
    let (sender,receiver)=std::sync::mpsc::channel();let _=EXECUTION_QUEUE.set(sender);
    // One owner preserves entry/exit order, including rapid Chrome/Desktop hops.
    thread::spawn(move||{for visible in receiver{render_execution_surface(&app,visible);}});
}

fn execution_notch_start_script(generation:u64)->String{
    format!("window.__itsflowExecutionStart={generation};window.startExecutionNotch?.({generation});")
}
pub fn execution_surface_line(line:&str)->bool{
    let Some(state)=line.trim().strip_prefix("EXECUTION_SURFACE|")else{return false};
    if !["desktop","chrome","end"].contains(&state){return false;}
    execution_surface(state=="desktop");true
}
pub fn execution_surface(visible:bool){
    if let Some(queue)=EXECUTION_QUEUE.get(){let _=queue.send(visible);}
}
fn render_execution_surface(app:&AppHandle,visible:bool){
    EXECUTION_VISIBLE.store(visible,Ordering::SeqCst);
    let generation=EXECUTION_GENERATION.fetch_add(1,Ordering::SeqCst)+1;
    // This function runs on the dedicated worker, never the WebView2 main thread.
    let target=app.clone();
        if !visible{
            for label in AURA_EDGES.iter().map(|e|format!("execution-aura-{e}")).chain(std::iter::once("execution-notch".into())){
                if let Some(w)=target.get_webview_window(&label){let _=w.eval("window.stopItsflowAura?.();document.body.classList.add('execution-leave');");}
            }
            let app=target.clone();thread::spawn(move||{
                thread::sleep(Duration::from_millis(450));let hide=app.clone();let _=app.run_on_main_thread(move||{
                    if EXECUTION_GENERATION.load(Ordering::SeqCst)!=generation{return;}
                    for label in AURA_EDGES.iter().map(|e|format!("execution-aura-{e}")).chain(std::iter::once("execution-notch".into())){if let Some(w)=hide.get_webview_window(&label){set_overlay_visible(&w,false);}}
                });
            });return;
        }
        let monitor=target.get_webview_window("main").and_then(|w|w.current_monitor().ok().flatten()).or_else(||target.primary_monitor().ok().flatten());
        let Some(monitor)=monitor else{return};
        let notch=if let Some(w)=target.get_webview_window("execution-notch"){Some(w)}else{
            tauri::WebviewWindowBuilder::new(&target,"execution-notch",tauri::WebviewUrl::App("execution-notch.html".into()))
                .on_page_load(|webview,payload|{
                    if matches!(payload.event(),tauri::webview::PageLoadEvent::Finished)&&EXECUTION_VISIBLE.load(Ordering::SeqCst){
                        let _=webview.eval(&execution_notch_start_script(EXECUTION_GENERATION.load(Ordering::SeqCst)));
                    }
                })
                .title("Sync - Executando no Desktop").inner_size(270.,64.).decorations(false).transparent(true)
                .background_color(tauri::webview::Color(0,0,0,0)).always_on_top(true).skip_taskbar(true)
                .resizable(false).shadow(false).focused(false).visible(false).build().ok().map(|w|{install_overlay_frame_guard(&w);w})
        };
        if let Some(w)=notch{
            prepare_overlay(&w);
            if w.set_ignore_cursor_events(true).is_ok(){
                let scale=monitor.scale_factor();let pos=monitor.position();let size=monitor.size();
                let _=w.set_position(tauri::PhysicalPosition::new(pos.x+(size.width as f64-270.*scale).round()as i32/2,pos.y));
                #[cfg(windows)]{use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity,WDA_EXCLUDEFROMCAPTURE};if let Ok(hwnd)=w.hwnd(){unsafe{let _=SetWindowDisplayAffinity(HWND(hwnd.0 as _),WDA_EXCLUDEFROMCAPTURE);}}}
                let _=w.eval(&execution_notch_start_script(generation));set_overlay_visible(&w,true);
            }
        }
        show_auras(&target,&monitor,"execution-aura");
        let started=aura_started();
        for edge in AURA_EDGES{if let Some(w)=target.get_webview_window(&format!("execution-aura-{edge}")){let _=w.eval(&format!("window.startItsflowAura?.({started});"));}}
}
