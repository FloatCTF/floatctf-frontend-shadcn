/** adminInfra domain copy (English). */

export default {
	specialized: "Specialized",
	docker: {
		documentTitle: "Docker · FloatCTF Console",
		title: "Docker",
		description:
			"Host container / image / network governance. Every call goes through the host helper's restricted protocol; if the helper is not ready the API returns 5xx and the backend message is shown below.",
		tabs: {
			containers: "Containers",
			images: "Images",
			networks: "Networks",
		},
		columns: {
			name: "Name",
			containerId: "Container ID",
			image: "Image",
			status: "Status",
			ports: "Ports",
			createdAt: "Created",
			tags: "Tags",
			imageId: "Image ID",
			size: "Size",
			driver: "Driver",
			scope: "Scope",
			subnet: "Subnet",
			gateway: "Gateway",
			networkId: "Network ID",
		},
		status: {
			created: "Created",
			running: "Running",
			paused: "Paused",
			restarting: "Restarting",
			removing: "Removing",
			exited: "Exited",
			dead: "Dead",
		},
		containers: {
			section: {
				title: "Containers",
				description:
					"The server paginates by offset/limit; the backend has no filter endpoint, so search only applies to the current page.",
			},
			searchPlaceholder: "Filter within this page (name / ID / image / status)",
			errorTitle: "Failed to load containers",
			empty: {
				title: "No containers",
				description:
					"No container exists on the host yet. If this should not be empty, check the helper status.",
			},
			filtered: {
				title: "No containers match on this page",
				description:
					"The Docker API has no server-side filtering; change the page or clear the search.",
			},
			portsLabel: "Ports",
			actions: {
				start: "Start container",
				stop: "Stop container",
				delete: "Delete container",
				startShort: "Start",
				stopShort: "Stop",
				deleteShort: "Delete",
			},
			toast: {
				started: "Container {{name}} started",
				stopped: "Container {{name}} stopped",
				deleted: "Container {{name}} deleted",
				startFailed: "Failed to start the container",
				stopFailed: "Failed to stop the container",
				deleteFailed: "Failed to delete the container",
			},
			confirm: {
				start: {
					title: "Start container {{name}}?",
					description: "Image {{image}}",
					consequenceResources:
						"The container restarts with its existing configuration and consumes host ports and resources",
					consequenceLifecycle:
						"If it is a platform-managed challenge / GameBox instance container, its state can diverge from the instance lifecycle",
					confirm: "Start",
				},
				stop: {
					title: "Stop container {{name}}?",
					description: "Image {{image}} · current status {{status}}",
					consequenceProcesses:
						"Processes inside the container are killed and all unpersisted data (memory state / temporary files) is lost",
					consequencePlayers:
						"Any instance environment players are using becomes unavailable immediately",
					consequenceRestart:
						"The container will not restart automatically (platform instances need the normal start flow)",
					confirm: "Stop container",
				},
				delete: {
					title: "Delete container {{name}}?",
					description: "Image {{image}} · status {{status}}",
					consequenceData:
						"The container is force-removed (including its writable layer); data inside it is lost permanently",
					consequenceInstance:
						"If the container still belongs to an event instance, platform records will diverge from the removed runtime resource",
					consequenceIrreversible:
						"Deletion is irreversible; recovery requires recreating from the image",
					confirm: "Delete permanently",
				},
			},
		},
		images: {
			section: {
				title: "Images",
				description:
					"The server paginates by offset/limit; search only applies to the current page.",
			},
			searchPlaceholder: "Filter within this page (tag / ID)",
			errorTitle: "Failed to load images",
			empty: {
				title: "No images",
				description:
					"No image exists on the host yet; platform images are usually written by build / pull flows.",
			},
			filtered: {
				title: "No images match on this page",
				description:
					"The Docker API has no server-side filtering; change the page or clear the search.",
			},
			actions: {
				delete: "Delete image",
				deleteShort: "Delete",
			},
			toast: {
				deleted: "Image deleted",
				deleteFailed: "Failed to delete the image",
			},
			confirm: {
				title: "Delete image {{name}}?",
				description: "Image ID {{id}} · size {{size}}",
				consequenceDependents:
					"Containers that depend on this image can no longer be created / restarted (running containers are unaffected)",
				consequenceRebuild:
					"Recovery requires pulling or rebuilding the image, which depends on network and build time",
				consequenceIrreversible: "Deletion is irreversible",
				confirm: "Delete permanently",
			},
		},
		networks: {
			section: {
				title: "Networks",
				description:
					"The server paginates by offset/limit; search only applies to the current page.",
			},
			searchPlaceholder: "Filter within this page (name / subnet)",
			errorTitle: "Failed to load networks",
			empty: {
				title: "No networks",
				description:
					"No custom network exists on the host yet; platform arena networks are usually created by event flows.",
			},
			filtered: {
				title: "No networks match on this page",
				description:
					"The Docker API has no server-side filtering; change the page or clear the search.",
			},
			create: "New network",
			actions: {
				delete: "Delete network",
				deleteShort: "Delete",
			},
			toast: {
				deleted: "Network deleted",
				deleteFailed: "Failed to delete the network",
				created: "Network created",
				createdDescription: "Containers can now join it by name.",
				createFailed: "Failed to create the network",
			},
			confirm: {
				title: "Delete network {{name}}?",
				description: "Driver {{driver}} · scope {{scope}} · subnet {{subnet}}",
				consequenceConnectivity:
					"Containers attached to this network lose connectivity (cross-container traffic and gateway access stop)",
				consequenceEndpoints:
					"Docker refuses to delete a network with active endpoints; the backend then returns the concrete error",
				consequenceIrreversible:
					"Deletion is irreversible; the network must be recreated and containers reattached",
				confirm: "Delete permanently",
			},
			form: {
				title: "New Docker network",
				description:
					"Creates a custom bridge network with an explicit subnet and gateway. Name / subnet conflicts return Docker's original error.",
				fields: {
					name: "Name",
					subnet: "Subnet",
					gateway: "Gateway",
					driver: "Driver",
				},
				placeholders: {
					name: "e.g. fctf-awd-net",
					subnet: "172.20.0.0/16",
					gateway: "172.20.0.1",
				},
				errors: {
					name: "Network name is required",
					subnet: "Subnet is required (e.g. 172.20.0.0/16)",
					gateway: "Gateway is required (e.g. 172.20.0.1)",
				},
				driverHint: "Defaults to bridge.",
				submit: "Create",
				hint: "Name, subnet and gateway are required",
				note: "The subnet must not overlap existing host networks; once created it can be referenced by event / GameBox allocation flows.",
			},
		},
	},
	sql: {
		documentTitle: "SQL Console · FloatCTF Console",
		title: "SQL Console",
		description:
			"Runs statements directly against the platform PostgreSQL. Restricted to superadmin and requires [features].unsafe_sql_admin in TOML.",
		badge: "Critical",
		actions: {
			clear: "Clear",
			execute: "Execute",
			executing: "Running {{done}}/{{total}}",
		},
		warning: {
			title: "This is a direct execution path into the production database",
			body: "Write statements cannot be undone; type the confirmation phrase <mono>{{phrase}}</mono> before running. Multi-statement input is split on `;` and submitted <strong>statement by statement</strong> (the backend rejects multi-statement requests); write statements automatically get the <mono>{{prefix}}</mono> prefix.",
		},
		editor: {
			title: "Statements",
			description:
				"Detected {{count}} statement(s){{writeNote}}; the limit is {{max}} characters per statement and the timeout is {{timeout}}s.",
			writeNote: " ({{count}} of them write statements)",
			ariaLabel: "SQL input",
			placeholder: "SELECT * FROM users LIMIT 10;",
			examples: "Common queries (click to insert)",
		},
		result: {
			title: "Results",
			descriptionExecuted: "Last run: {{time}}",
			descriptionIdle: "Results and backend errors appear here after execution.",
			running: "Running {{done}}/{{total}}",
			emptyTitle: "No results yet",
			emptyDescription:
				"Enter SQL and execute; each statement's result and error is listed separately.",
			itemLabel: "#{{index}} {{status}}",
			success: "Succeeded",
			failure: "Failed",
			rows: "{{count}} rows",
			rowsAffected: "{{count}} rows affected",
			elapsed: "{{ms}} ms",
			resultEmpty: "The query returned no rows",
			resultCount: "{{count}} rows in total",
		},
		confirm: {
			title: "Execute {{count}} SQL statement(s)?",
			descriptionWrite:
				"{{count}} of them are write statements (the frontend adds the backend-required ADMIN_CONFIRMED prefix)",
			descriptionReadOnly:
				"All of them are read-only queries (select / show / describe / explain / with)",
			consequenceReal:
				"Statements run against the platform production database and cannot be undone (writes commit immediately)",
			consequenceDamage:
				"Deleting / updating table rows can irreversibly damage scores, event configuration and accounts",
			consequenceTimeout:
				"A statement over 5 seconds is aborted by the backend; the run is recorded in the audit log (without the SQL body)",
			consequenceTooLong:
				"{{count}} statement(s) exceed the {{max}}-character limit and will be rejected by the backend",
			consequenceSequential:
				"After confirmation statements run in order; a failure does not stop the remaining ones",
			confirm: "Execute",
		},
		toast: {
			emptyInput: "Enter at least one SQL statement",
			allDone: "All {{count}} statement(s) finished",
			partial: "{{success}} succeeded, {{failed}} failed",
			partialDescription: "See the per-statement results and backend errors below.",
		},
		statement: {
			label: "Statement {{index}}",
			tooLong:
				"Statement length {{length}} exceeds the backend limit of {{max}} characters; not submitted",
			failed: "Execution failed",
		},
	},
	terminal: {
		documentTitle: "Web Terminal · FloatCTF Console",
		title: "Web Terminal",
		description:
			"An interactive shell on the host helper (fish > zsh > bash > sh). Authentication uses a one-time HttpOnly ticket; the token never enters the URL.",
		status: {
			idle: "Not connected",
			authorizing: "Requesting terminal ticket…",
			connecting: "Opening WebSocket…",
			connected: "Connected",
			closed: "Disconnected",
			error: "Connection failed",
		},
		actions: {
			connect: "Open terminal",
			reconnect: "Reconnect",
		},
		confirm: {
			title: "Open a host web terminal?",
			description: "Starts an interactive shell on the host helper.",
			consequenceHost:
				"Commands run on the host with host privileges, equivalent to operating the host directly",
			consequenceRealtime:
				"Changes to containers / networks / files take effect immediately and cannot be undone",
			consequenceSession:
				"Closing the page or reconnecting ends the current session; tickets are one-time and cannot be reused",
			confirm: "Open terminal",
		},
		warning:
			"The terminal lands directly on the host: commands run with host privileges and really modify containers / networks / files. Closing the page or clicking “Reconnect” ends the current session (the ticket is one-time and cannot be reused).",
		error: {
			fallback: "Terminal connection failed",
			withBackend: "{{message}} — backend: {{backend}}",
			disabledHint:
				"{{message}} (the terminal may be disabled via [features].enable_web_terminal in TOML)",
			wsError: "WebSocket connection error (the ticket may be expired or rejected)",
			closed: "Connection closed",
			closedWithCode: "Connection closed (code={{code}})",
			closedWithReason: "Connection closed (code={{code}} {{reason}})",
		},
		section: {
			title: "Interactive terminal",
			description: "WS endpoint: <mono>{{url}}</mono> (derived from adminBaseUrl)",
			idleTitle: "Terminal not open",
			idleDescription:
				"Use “Open terminal” in the header to establish a WebSocket session; that session carries host shell privileges.",
			connectedLine: "Connected to the platform web terminal (one-time ticket consumed)",
		},
	},
	version: {
		documentTitle: "Platform Version · FloatCTF Console",
		title: "Platform version",
		description:
			"Backend API version and frontend runtime contract versions. Contract versions decide whether a pluggable frontend is compatible.",
		stats: {
			api: "Platform API",
			apiHint: "GET /api/admin/system/version",
			runtimeContract: "Frontend runtime contract",
			runtimeContractHint: "{{name}} (compile-time constant)",
			apiContract: "API contract",
			apiContractHint: "{{name}} (compile-time constant)",
			fullVersion: "Runtime full version",
			fullVersionHint: "{{name}} (diagnostics only)",
		},
		rows: {
			title: "Version information",
			version: "Frontend artifact (floatctf-web)",
			missing: "The backend returned no version",
		},
		loading: "Loading version…",
		errorTitle: "Failed to load the platform version",
		apiSection: {
			title: "Backend API version",
			description:
				"Comes from the real API; on failure the backend message is shown and can be retried.",
			missing: "(the backend returned no version)",
		},
		contracts: {
			title: "Contract versions",
			description:
				"The three version concepts are independent; a frontend and registry compatibility must match the runtime / API contract major.",
			hints: {
				runtime: "Changes when the frontend.json or mount(context) contract breaks",
				api: "Changes when the frontend-visible HTTP API breaks (removed field / changed semantics)",
				full: "Includes minor/patch; diagnostics only",
			},
		},
	},
};
