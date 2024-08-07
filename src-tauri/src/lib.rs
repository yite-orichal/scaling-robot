use std::{collections::HashMap, time::Duration};

use log::{debug, LevelFilter};
use state::{
    EvmProviderState, EvmRpcClientState, HttpClientState, ProjectState, ProxiedHttpClientState,
    SolRpcClientState, TradeTaskState,
};
use tauri::{
    menu::{AboutMetadata, Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    webview::{PageLoadEvent, PageLoadPayload},
    App, AppHandle, LogicalPosition, LogicalSize, Manager, RunEvent, Webview, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_log::{
    fern::colors::{Color, ColoredLevelConfig},
    Target, TargetKind,
};

mod chain;
mod commands;
mod consts;
mod contracts;
mod error;
#[allow(unused)]
mod jup;
mod one_inch;
mod project;
mod state;
mod task;
mod token;
mod utils;
mod wallet;

#[cfg(debug_assertions)]
const APPLIB_LOGLEVEL: LevelFilter = LevelFilter::Debug;

#[cfg(not(debug_assertions))]
const APPLIB_LOGLEVEL: LevelFilter = LevelFilter::Warn;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let default_http_client = reqwest::ClientBuilder::default()
        .connect_timeout(Duration::from_secs(5))
        .read_timeout(Duration::from_secs(10))
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap();

    let app = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([Target::new(TargetKind::Stdout)])
                .with_colors(
                    ColoredLevelConfig::default()
                        .info(Color::Green)
                        .debug(Color::BrightBlue),
                )
                .level(LevelFilter::Error)
                .level_for("app_lib", APPLIB_LOGLEVEL)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .manage(ProjectState::new(None))
        .manage(TradeTaskState::new(HashMap::new()))
        .manage(SolRpcClientState::new(None))
        .manage(EvmRpcClientState::new(None))
        .manage(EvmProviderState::new(None))
        .manage(ProxiedHttpClientState::new(vec![]))
        .manage(HttpClientState(default_http_client))
        .menu(|app_handle| {
            let pkg_info = app_handle.package_info();
            let config = app_handle.config();
            #[cfg(target_os = "macos")]
            let about_metadata = AboutMetadata {
                name: Some(pkg_info.name.clone()),
                version: Some(pkg_info.version.to_string()),
                copyright: config.bundle.copyright.clone(),
                authors: config.bundle.publisher.clone().map(|p| vec![p]),
                ..Default::default()
            };

            Menu::with_items(
                app_handle,
                &[
                    #[cfg(target_os = "macos")]
                    &Submenu::with_items(
                        app_handle,
                        pkg_info.name.clone(),
                        true,
                        &[
                            &PredefinedMenuItem::about(app_handle, None, Some(about_metadata))?,
                            &PredefinedMenuItem::separator(app_handle)?,
                            &PredefinedMenuItem::services(app_handle, None)?,
                            &PredefinedMenuItem::separator(app_handle)?,
                            &PredefinedMenuItem::hide(app_handle, None)?,
                            &PredefinedMenuItem::hide_others(app_handle, None)?,
                            &PredefinedMenuItem::separator(app_handle)?,
                            // &PredefinedMenuItem::quit(app_handle, None)?,
                            #[cfg(not(any(
                                target_os = "linux",
                                target_os = "dragonfly",
                                target_os = "freebsd",
                                target_os = "netbsd",
                                target_os = "openbsd"
                            )))]
                            &PredefinedMenuItem::close_window(app_handle, Some("Quit"))?,
                        ],
                    )?,
                    &Submenu::with_items(
                        app_handle,
                        "&Edit",
                        true,
                        &[
                            &PredefinedMenuItem::undo(app_handle, None)?,
                            &PredefinedMenuItem::redo(app_handle, None)?,
                            &PredefinedMenuItem::separator(app_handle)?,
                            &PredefinedMenuItem::cut(app_handle, None)?,
                            &PredefinedMenuItem::copy(app_handle, None)?,
                            &PredefinedMenuItem::paste(app_handle, None)?,
                            &PredefinedMenuItem::select_all(app_handle, None)?,
                        ],
                    )?,
                    #[cfg(target_os = "macos")]
                    &Submenu::with_items(
                        app_handle,
                        "View",
                        true,
                        &[&PredefinedMenuItem::fullscreen(app_handle, None)?],
                    )?,
                ],
            )
        })
        .on_page_load(on_page_load_handler)
        .setup(setup_app)
        .invoke_handler(commands::invoke_hanlders())
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(move |app_handle, evt| match &evt {
        RunEvent::ExitRequested { code, api, .. } => {
            debug!("exit requested: {code:?}");
            if code.is_none() {
                api.prevent_exit();
            }
        }
        RunEvent::WindowEvent {
            label,
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } if label == "main" => {
            api.prevent_close();
            let handle_to_exit = app_handle.app_handle().clone();
            app_handle
                .dialog()
                .message("Confirm Exit This App ?")
                .title("Confirm Exit")
                .ok_button_label("Ok")
                .cancel_button_label("Cancel")
                .show(move |is_confirmed| {
                    if is_confirmed {
                        handle_to_exit.exit(0);
                    }
                });
        }
        _ => {}
    });
}

fn on_page_load_handler(webview: &Webview, payload: &PageLoadPayload) {
    if webview.label() == "main" && PageLoadEvent::Finished == payload.event() {
        if let Some(splash_win) = webview.get_webview_window("splash") {
            splash_win.close().expect("close splash window error");
        }
        webview.window().show().expect("error show window");
    }
}

fn setup_app(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    // create_tray(app)?;
    // NOTE: Following Code Can Enable Splash Screen
    //
    // WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("splash".into()))
    //     .title("Moo Tools")
    //     .decorations(false)
    //     .resizable(false)
    //     .center()
    //     .inner_size(400.0, 300.0)
    //     .build()?;

    let main_window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("Moo Tools")
        .inner_size(1280.0, 900.0)
        .min_inner_size(1280.0, 900.0)
        .visible(false)
        .focused(false)
        .build()?;

    let monitor = if tauri::is_dev() {
        debug!("is dev env");
        main_window.primary_monitor()?
    } else {
        main_window.current_monitor()?
    };

    if let Some(monitor) = monitor {
        let scale_factor = monitor.scale_factor();
        let monitor_pos = monitor.position().to_logical::<i32>(scale_factor);
        let monitor_size = monitor.size().to_logical::<i32>(scale_factor);
        let win_size = LogicalSize::new(1280, 900);
        main_window.set_size(win_size)?;

        let win_pos = LogicalPosition::new(
            monitor_pos.x + (monitor_size.width - win_size.width) / 2,
            monitor_pos.y + (monitor_size.height - win_size.height) / 2,
        );
        main_window.set_position(win_pos)?;
    }

    if !tauri::is_dev() {
        main_window.set_focus()?;
    }

    Ok(())
}

#[allow(unused)]
fn create_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let menu_item_quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu_item_demo = MenuItem::with_id(app, "demo", "Demo", true, None::<&str>)?;
    let tray_menu = Menu::with_items(app, &[&menu_item_quit, &menu_item_demo])?;

    let _ = tauri::tray::TrayIconBuilder::with_id("moo-tools-tray")
        .tooltip("Moo Tools")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&tray_menu)
        .menu_on_left_click(false)
        .on_menu_event(on_tray_menu_event)
        .on_tray_icon_event(move |tray, evt| match evt {
            TrayIconEvent::Enter { .. } => {
                if let Some(_is_visible) = tray
                    .app_handle()
                    .get_webview_window("main")
                    .and_then(|w| w.is_visible().ok())
                {
                    // let menu_text = if is_visible { "Hide" } else { "Show" };
                    // menu_item_quit.set_text(menu_text).unwrap();
                }
            }
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } => {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(true) = window.is_visible() {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}

fn on_tray_menu_event(app_handle: &AppHandle, evt: MenuEvent) {
    match evt.id.as_ref() {
        "quit" => {
            let handle_to_exit = app_handle.app_handle().clone();
            app_handle
                .dialog()
                .message("Confirm Exit")
                .title("Confirm Exit")
                .ok_button_label("Ok")
                .cancel_button_label("Cancel")
                .show(move |is_confirmed| {
                    if is_confirmed {
                        handle_to_exit.exit(0);
                    }
                });
        }
        "demo" => {
            let _demo_window =
                WebviewWindowBuilder::new(app_handle, "demo", WebviewUrl::App("demo".into()))
                    .title("Demo")
                    .inner_size(800.0, 600.0)
                    .min_inner_size(800.0, 600.0)
                    .build()
                    .unwrap();
        }
        _ => {}
    }
}
