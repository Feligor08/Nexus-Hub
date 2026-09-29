export interface ProjectBlueprint {
  id: string;
  title: string;
  category: 'Software' | 'DevOps' | 'GameServer' | 'AI & Automation' | 'Maker' | 'ITA Curriculum';
  description: string;
  techStack: string[];
  status: 'In Entwicklung' | 'Aktiv' | 'Produktion' | 'Geplant';
  details: {
    architecture: string;
    keyPoints: string[];
    quickSnippetTitle: string;
    quickSnippetLanguage: string;
    quickSnippet: string;
  };
}

export interface Cheatsheet {
  id: string;
  title: string;
  category: string;
  description: string;
  code: string;
  language: string;
}

export const INITIAL_PROJECTS: ProjectBlueprint[] = [
  {
    id: 'nexus-code-play',
    title: 'Nexus Code Play Core Platform',
    category: 'Software',
    description: 'Zentrale Cyberpunk-Community- & Entwickler-Plattform für persönliche IT-Systeme, Code-Reviews und Assistenten-Workflows.',
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Express', 'Gemini AI API', 'Google Calendar'],
    status: 'In Entwicklung',
    details: {
      architecture: 'Full-Stack SPA mit Server-Side Gemini API Proxy, in-memory OAuth Token Caching und modularen Cyberpunk UI-Komponenten.',
      keyPoints: [
        'Multi-Turn Chatbot mit rollenspezifischen System Instructions',
        'Strukturierter 5-Stufen Debugger nach industriellen Standards',
        'Google Workspace Calendar Integration für Klausurtermine und Server-Wartung',
        'Anti-Slop Design nach Frontend Design Constitution'
      ],
      quickSnippetTitle: 'Full-Stack Gemini Proxy (server.ts)',
      quickSnippetLanguage: 'typescript',
      quickSnippet: `// Server-Side Gemini Proxy
app.post('/api/chat', async (req, res) => {
  const { messages, role } = req.body;
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    config: { systemInstruction: SYSTEM_INSTRUCTIONS[role] }
  });
  res.json({ reply: response.text });
});`
    }
  },
  {
    id: 'hp-elitedesk-homeserver',
    title: 'HP EliteDesk 800 G3 Mini Server Stack',
    category: 'DevOps',
    description: 'Kompakter 24/7 Home-Server mit Ubuntu Server, CasaOS, Docker, Nginx Proxy Manager, Tailscale und lokaler MariaDB.',
    techStack: ['Ubuntu Server 24.04', 'CasaOS', 'Docker Compose', 'Tailscale', 'Nginx Proxy Manager', 'MariaDB'],
    status: 'Aktiv',
    details: {
      architecture: 'Isolierte Docker-Netzwerke, benannte Persistent Volumes, TLS über Nginx Proxy Manager und privater Fernzugriff via Tailscale Mesh-VPN.',
      keyPoints: [
        'Keine offenen Router-Ports ins Internet dank Tailscale',
        'CasaOS Web UI für schnelles Monitoring und App-Verwaltung',
        'Automatisierte MariaDB Dumps auf externe USB-Sicherung',
        'Least Privilege & non-root Container Ausführung'
      ],
      quickSnippetTitle: 'docker-compose.yml (MariaDB & NPM)',
      quickSnippetLanguage: 'yaml',
      quickSnippet: `services:
  mariadb:
    image: mariadb:11.4
    container_name: mariadb_core
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_pwd
      MYSQL_DATABASE: ita_projects
      MYSQL_USER: dev_feligor
      MYSQL_PASSWORD_FILE: /run/secrets/db_dev_pwd
    volumes:
      - mariadb_data:/var/lib/mysql
    networks:
      - internal_backend

  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx_proxy_manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - npm_data:/data
      - npm_letsencrypt:/etc/letsencrypt
    networks:
      - internal_backend

networks:
  internal_backend:
    name: internal_backend

volumes:
  mariadb_data:
  npm_data:
  npm_letsencrypt:`
    }
  },
  {
    id: 'wpf-management-app',
    title: 'C# / WPF .NET 10 Management Suite',
    category: 'Software',
    description: 'Moderne Windows-Desktop-Anwendung für ITA-Projektverwaltung mit MVVM-Muster, Dependency Injection und SQLite/MariaDB.',
    techStack: ['C#', '.NET 10.0', 'WPF', 'CommunityToolkit.Mvvm', 'Entity Framework Core', 'MariaDB'],
    status: 'In Entwicklung',
    details: {
      architecture: 'Strikte Trennung von View, ViewModel und Model. Keine Business-Logik im Code-Behind (.xaml.cs). Async Commands und sauber gebundene Collections.',
      keyPoints: [
        'RelayCommand für saubere UI-Interaktionen',
        'ObservableProperty Source Generators für schlanke ViewModels',
        'Repository Pattern für flexible Datenbankanbindung',
        'Semantische Benennungskonventionen für Controls (txtBenutzer, btnSpeichern)'
      ],
      quickSnippetTitle: 'ProjectViewModel.cs (MVVM)',
      quickSnippetLanguage: 'csharp',
      quickSnippet: `using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;

namespace NexusCodePlay.ViewModels
{
    public partial class ProjectViewModel : ObservableObject
    {
        private readonly IProjectService _projectService;

        [ObservableProperty]
        private string _txtProjektTitel = string.Empty;

        [ObservableProperty]
        private bool _isBusy;

        public ObservableCollection<ProjectItem> Projects { get; } = new();

        public ProjectViewModel(IProjectService projectService)
        {
            _projectService = projectService;
        }

        [RelayCommand]
        private async Task LadeProjekteAsync()
        {
            if (IsBusy) return;
            IsBusy = true;
            try
            {
                var result = await _projectService.GetProjectsAsync();
                Projects.Clear();
                foreach (var item in result) Projects.Add(item);
            }
            finally { IsBusy = false; }
        }
    }
}`
    }
  },
  {
    id: 'minecraft-fabric-server',
    title: 'Minecraft Fabric Server & Custom Modding',
    category: 'GameServer',
    description: 'Leistungsfähiger Minecraft Server auf Fabric mit dedizierten Optimierungsmods und eigenen serverseitigen Fabric-Mod-Erweiterungen.',
    techStack: ['Java 21', 'Fabric Loader', 'Fabric API', 'Mixins', 'Lithium', 'FerriteCore'],
    status: 'Aktiv',
    details: {
      architecture: 'Modulare Trennung von Client-Only Rendering und serverseitiger Tick-Logik. Sauberes Mixin-Injection Handling.',
      keyPoints: [
        'Strikte Java 21 LTS Kompatibilität',
        'Profiling mit Spark für lagfreie Ticks',
        'Eigene Mod-Logik für Spieler-Statistiken und ITA-Community-Features'
      ],
      quickSnippetTitle: 'FabricMod.java (Lifecycle Entrypoint)',
      quickSnippetLanguage: 'java',
      quickSnippet: `package de.nexus.fabricmod;

import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class NexusMod implements ModInitializer {
    public static final String MOD_ID = "nexuscodeplay";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitialize() {
        LOGGER.info("Nexus Code Play Fabric Mod initialized on Fabric Loader!");
        // Server-Side Event Listener registration
    }
}`
    }
  },
  {
    id: 'roblox-lua-framework',
    title: 'Roblox Luau Secure Client-Server Architecture',
    category: 'GameServer',
    description: 'Roblox-Erlebnis mit strikter Server-Autorität, RemoteEvent-Ratenbegrenzung und serverseitiger Validierung.',
    techStack: ['Luau', 'Roblox Studio', 'RemoteEvents', 'DataStoreService'],
    status: 'In Entwicklung',
    details: {
      architecture: 'Zero-Trust-Prinzip: Der Client steuert nur UI und Kamera, alle Transaktionen, Physikberechnungen und Fortschritte werden serverseitig autorisiert.',
      keyPoints: [
        'Anti-Exploit durch serverseitige Bounds-Prüfung',
        'Sichere RemoteFunction Aufrufe mit Timeout und PCall',
        'DataStore2 / ProfileService für unzerstörbare Spielstände'
      ],
      quickSnippetTitle: 'ServerHandler.server.luau',
      quickSnippetLanguage: 'lua',
      quickSnippet: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ActionEvent = ReplicatedStorage:WaitForChild("ExecuteAction")

local function onActionReceived(player: Player, actionType: string, payload: any)
    -- NIEMALS dem Client blind vertrauen!
    if typeof(actionType) ~= "string" or #actionType > 50 then return end
    
    -- Serverseitige Validierung
    local character = player.Character
    if not character or not character:FindFirstChild("HumanoidRootPart") then return end
    
    print(string.format("[Server] Validierte Aktion von %s: %s", player.Name, actionType))
end

ActionEvent.OnServerEvent:Connect(onActionReceived)`
    }
  },
  {
    id: 'ollama-n8n-pipeline',
    title: 'Lokale KI-Automatisierung mit Ollama & n8n',
    category: 'AI & Automation',
    description: 'Datenschutzkonforme, lokale KI-Workflows mit Llama 3.2 auf n8n zur automatisierten Notizen- und Aufgabenverarbeitung.',
    techStack: ['Ollama', 'Llama 3.2', 'n8n', 'CouchDB', 'Obsidian LiveSync', 'Docker'],
    status: 'Aktiv',
    details: {
      architecture: 'n8n Webhook -> Ollama REST API (11434) -> Markdown-Zusammenfassung -> CouchDB LiveSync für Obsidian Notizen.',
      keyPoints: [
        '100% lokale Datenverarbeitung ohne Cloud-Abhängigkeit',
        'Automatische Klassifizierung von ITA-Lernzetteln',
        'Strukturierte JSON-Ausgabe mit Idempotenz-Prüfung'
      ],
      quickSnippetTitle: 'n8n Ollama Request Payload',
      quickSnippetLanguage: 'json',
      quickSnippet: `{
  "model": "llama3.2:latest",
  "prompt": "Fasse diesen ITA-Unterrichtsstoff strukturiert zusammen:",
  "stream": false,
  "options": {
    "temperature": 0.2,
    "num_ctx": 4096
  }
}`
    }
  },
  {
    id: '8051-assembler-lab',
    title: '8051 Mikrocontroller Assembler Labor',
    category: 'ITA Curriculum',
    description: 'Hardwarenahe Programmierung auf dem 8051 Mikrocontroller für schulische Praktika und Prüfungen.',
    techStack: ['8051 Assembler', 'Keil µVision', 'Timer 0/1', 'Interrupt-Vektoren', 'Port I/O'],
    status: 'Aktiv',
    details: {
      architecture: 'Direkte Register- und Speicherverwaltung (SRAM, Bitadressierung, SFR). Exakte Taktzyklus-Berechnung für Verzögerungsschleifen.',
      keyPoints: [
        'Timer-Konfiguration in Modus 1 (16-Bit Timer)',
        'Interrupt-gesteuerte Taster-Entprellung an INT0',
        'Siebensegment-Anzeige Multiplexing über Port 1 und 2'
      ],
      quickSnippetTitle: 'Timer0_Delay.asm',
      quickSnippetLanguage: 'asm',
      quickSnippet: `ORG 0000H
    LJMP MAIN

ORG 000BH             ; Timer 0 Interrupt Vector
    LJMP T0_ISR

MAIN:
    MOV TMOD, #01H     ; Timer 0 Modus 1 (16-Bit)
    MOV TH0, #0D8H     ; Vorladen für 10ms bei 12MHz
    MOV TL0, #0F0H
    SETB ET0           ; Timer 0 Interrupt aktivieren
    SETB EA            ; Global Interrupt Enable
    SETB TR0           ; Timer starten

LOOP:
    SJMP LOOP

T0_ISR:
    MOV TH0, #0D8H     ; Erneut vorladen
    MOV TL0, #0F0H
    CPL P1.0           ; Toggle LED an P1.0
    RETI
END`
    }
  },
  {
    id: 'bambu-p1s-maker-lab',
    title: 'Bambu Lab P1S 3D-Druck & Gridfinity',
    category: 'Maker',
    description: 'Präzisionsfertigung von Gehäusen, Gridfinity-Werkstattmodulen und Bento3D Bauraumluftfiltern für PLA & PETG.',
    techStack: ['Bambu Lab P1S Combo', 'Bambu Studio', 'PLA', 'PETG', 'Tinkercad', 'Gridfinity', 'Bento3D'],
    status: 'Aktiv',
    details: {
      architecture: 'Optimierte Slicer-Profile für funktionale Bauteile: 4 Wandlinien, 25% Gyroid Infill, korrekte Bauraumtemperaturen für PETG ohne Warping.',
      keyPoints: [
        'Bento3D Aktivkohle- und HEPA-Filtration für saubere Raumluft',
        'Modulare Gridfinity-Einsätze für Elektronik- und Werkzeugorganisation',
        'Individuelle 3D-gedruckte Halterungen für den HP EliteDesk Mini PC'
      ],
      quickSnippetTitle: 'PETG Slicer Parameter',
      quickSnippetLanguage: 'text',
      quickSnippet: `Düse: 0.4mm Gehärteter Stahl
Drucktemperatur: 245°C First Layer / 250°C Folgelayer
Druckbett (Textured PEI): 75°C
Kühlung: 30% Part Fan (erst ab Layer 4)
Wände: 4 Loops
Infill: 25% Gyroid
Druckgeschwindigkeit Außenwand: 120 mm/s`
    }
  }
];

export const INITIAL_CHEATSHEETS: Cheatsheet[] = [
  {
    id: 'cs-8051-regs',
    title: '8051 Register & SFR Referenz',
    category: '8051 Assembler',
    description: 'Wichtigste Register, SFR-Adressen und TMOD-Flags für die ITA-Klausurvorbereitung.',
    language: 'text',
    code: `Registerbänke (SRAM 00H-1FH):
Bank 0: 00H-07H | Bank 1: 08H-0FH | Bank 2: 10H-17H | Bank 3: 18H-1FH
Umschaltung via PSW.3 (RS0) und PSW.4 (RS1)

Wichtige Special Function Registers (SFRs):
- ACC (Accumulator): E0H (Mathematische Operationen)
- B: F0H (Multiplikation & Division mit MUL AB / DIV AB)
- DPH/DPL (Data Pointer): 83H/82H (16-Bit Adressierung externer Speicher)
- PSW (Program Status Word): D0H [CY, AC, F0, RS1, RS0, OV, -, P]
- P0: 80H | P1: 90H | P2: A0H | P3: B0H
- TMOD (Timer Mode): 89H [GATE, C/T, M1, M0 | GATE, C/T, M1, M0]`
  },
  {
    id: 'cs-wpf-mvvm',
    title: 'C# / WPF MVVM Boilerplate (.NET 10)',
    category: 'C# & WPF',
    description: 'CommunityToolkit.Mvvm Best-Practice mit Dependency Injection und ICommand.',
    language: 'csharp',
    code: `// App.xaml.cs Dependency Injection
public partial class App : Application
{
    public static IServiceProvider Services { get; private set; }

    public App()
    {
        var services = new ServiceCollection();
        services.AddSingleton<MainWindow>();
        services.AddSingleton<MainViewModel>();
        services.AddSingleton<IDataService, SqlDataService>();
        Services = services.BuildServiceProvider();
    }
}

// XAML DataContext Binding
<Window ... DataContext="{Binding Source={x:Static local:App.Services}, Path=GetRequiredService(local:MainViewModel)}">`
  },
  {
    id: 'cs-docker-compose-template',
    title: 'Docker Compose Best-Practice Template',
    category: 'DevOps',
    description: 'Sichere Vorlage mit benannten Netzwerken, Restart Policies, Healthchecks und Volume-Persistenz.',
    language: 'yaml',
    code: `services:
  app:
    image: my-service:1.2.0
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    user: "1000:1000"
    ports:
      - "127.0.0.1:8080:8080" # Nur lokal binden, NPM übernimmt TLS!
    environment:
      - NODE_ENV=production
    volumes:
      - app_data:/app/data:rw
    networks:
      - internal_net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  internal_net:
    driver: bridge

volumes:
  app_data:`
  },
  {
    id: 'cs-atruvia-wi-prep',
    title: 'Atruvia AG & Wirtschaftsinformatik Duales Studium Guide',
    category: 'Karriere & ITA',
    description: 'Kernfakten zu Atruvia AG, genossenschaftlicher FinanzGruppe und dualem Studienprofil.',
    language: 'markdown',
    code: `# Atruvia AG — IT-Partner der genossenschaftlichen FinanzGruppe

## Fakten & Fokus:
- Hauptstandorte: Karlsruhe, Münster, München, Frankfurt, Berlin
- Kernbanking-Software: agree21
- Rechenzentren für ca. 700+ Volksbanken und Raiffeisenbanken
- Hohe Sicherheits-, Hochverfügbarkeits- und Compliance-Standards (BAIT, ISO 27001)

## Kernkompetenzen für das duale Studium Wirtschaftsinformatik:
1. Software Engineering: Java, Microservices, REST, Clean Code
2. Datenbanken & Cloud: Relationale SQL-Systeme, Hochverfügbarkeit
3. Betriebswirtschaftslehre: Geschäftsprozesse von Finanzinstituten
4. IT-Security & Infrastruktur: Zero-Trust, Netzwerksicherheit, CI/CD`
  }
];

export const INITIAL_SCHEDULE_EVENTS = [
  {
    id: 'sched-1',
    summary: 'ITA Klausur: Anwendungsentwicklung (C# & OOP)',
    description: 'Schriftliche Prüfung im 2. Ausbildungsjahr über Vererbung, Interfaces, MVVM Grundlagen und SQL-Abfragen.',
    start: { dateTime: '2026-10-05T08:00:00+02:00' },
    end: { dateTime: '2026-10-05T10:00:00+02:00' },
    category: 'exam' as const,
  },
  {
    id: 'sched-2',
    summary: 'HomeServer Wartung: CasaOS & MariaDB Backup',
    description: 'HP EliteDesk 800 G3 Mini: Systemupdates, Docker prune, MariaDB Dump auf externes Sicherungslaufwerk.',
    start: { dateTime: '2026-10-08T18:00:00+02:00' },
    end: { dateTime: '2026-10-08T19:30:00+02:00' },
    category: 'homeserver' as const,
  },
  {
    id: 'sched-3',
    summary: 'Atruvia AG: Bewerbungsunterlagen & Portfolio Review',
    description: 'Zusammenstellung des Entwickler-Portfolios für das duale Studium Wirtschaftsinformatik (Nexus Code Play, WPF Suite, HomeServer).',
    start: { dateTime: '2026-10-12T14:00:00+02:00' },
    end: { dateTime: '2026-10-12T16:00:00+02:00' },
    category: 'atruvia' as const,
  },
  {
    id: 'sched-4',
    summary: 'ITA Labor: 8051 Assembler Timer & Interrupts',
    description: 'Laborübung: Timer 0 Modus 1 Frequenzgenerator und Tasterentprellung über INT0.',
    start: { dateTime: '2026-10-15T09:30:00+02:00' },
    end: { dateTime: '2026-10-15T12:00:00+02:00' },
    category: 'ita_school' as const,
  },
  {
    id: 'sched-5',
    summary: 'Minecraft Fabric Server Update & Backup',
    description: 'Fabric Modpack Update auf neue Mod-Versionen und Welt-Backup vor dem Community-Event.',
    start: { dateTime: '2026-10-18T16:00:00+02:00' },
    end: { dateTime: '2026-10-18T17:30:00+02:00' },
    category: 'project' as const,
  }
];
