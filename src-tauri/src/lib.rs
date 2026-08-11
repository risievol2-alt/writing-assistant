use std::{
    fs::{create_dir_all, OpenOptions},
    io,
    net::{TcpListener, TcpStream},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const DEV_PORT: u16 = 5173;
const SERVER_TIMEOUT: Duration = Duration::from_secs(20);
const SERVER_ENTRY: &str = "backend/src/server.js";

struct BackendProcess(Mutex<Option<Child>>);

impl BackendProcess {
    fn new(child: Option<Child>) -> Self {
        Self(Mutex::new(child))
    }

    fn stop(&self) {
        let Ok(mut guard) = self.0.lock() else {
            return;
        };
        let Some(mut child) = guard.take() else {
            return;
        };
        let _ = child.kill();
        let _ = child.wait();
    }
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        let Ok(child) = self.0.get_mut() else {
            return;
        };
        if let Some(mut child) = child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn reserve_port() -> io::Result<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
}

fn wait_for_port(port: u16, mut child: Option<&mut Child>) -> io::Result<()> {
    let deadline = Instant::now() + SERVER_TIMEOUT;
    let address = ([127, 0, 0, 1], port).into();

    while Instant::now() < deadline {
        if let Some(process) = child.as_deref_mut() {
            if let Some(status) = process.try_wait()? {
                return Err(io::Error::other(format!(
                    "backend stopped before startup completed: {status}",
                )));
            }
        }

        if TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(100));
    }

    Err(io::Error::new(
        io::ErrorKind::TimedOut,
        format!("timed out waiting for 127.0.0.1:{port}"),
    ))
}

fn spawn_packaged_backend(app: &tauri::App) -> Result<(Child, u16), Box<dyn std::error::Error>> {
    let port = reserve_port()?;
    let resource_dir = app.path().resource_dir()?;
    let data_dir = app.path().app_data_dir()?;
    create_dir_all(&data_dir)?;

    let node_name = if cfg!(windows) { "node.exe" } else { "node" };
    let node_path = resource_dir.join("runtime").join(node_name);
    let server_path = resource_dir.join(SERVER_ENTRY);
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join("backend.log"))?;

    if !node_path.is_file() || !server_path.is_file() {
        return Err(format!(
            "desktop resources are incomplete: {} / {}",
            node_path.display(),
            server_path.display(),
        )
        .into());
    }

    let mut child = Command::new(node_path)
        // Keep the entry point relative to the resource directory. Node on Windows
        // can misinterpret a Tauri verbatim absolute path (\\?\C:\...) as `C:`.
        .arg(SERVER_ENTRY)
        .current_dir(&resource_dir)
        .env("PORT", port.to_string())
        .env("INKSTONE_DATA_DIR", &data_dir)
        .env("INKSTONE_DESKTOP", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(log_file.try_clone()?))
        .stderr(Stdio::from(log_file))
        .spawn()?;

    wait_for_port(port, Some(&mut child))?;
    Ok((child, port))
}

fn create_main_window(app: &tauri::App, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let url = format!("http://127.0.0.1:{port}").parse()?;
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("砚习 · 个人写作训练助手")
        .inner_size(1280.0, 800.0)
        .min_inner_size(960.0, 640.0)
        .center()
        .on_navigation(move |navigation_url| {
            navigation_url.host_str() == Some("127.0.0.1")
                && navigation_url.port_or_known_default() == Some(port)
        })
        .build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let (child, port) = if cfg!(debug_assertions) {
                wait_for_port(DEV_PORT, None)?;
                (None, DEV_PORT)
            } else {
                let (child, port) = spawn_packaged_backend(app)?;
                (Some(child), port)
            };

            app.manage(BackendProcess::new(child));
            create_main_window(app, port)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main"
                && matches!(
                    event,
                    tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
                )
            {
                window.state::<BackendProcess>().stop();
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Inkstone");
}
