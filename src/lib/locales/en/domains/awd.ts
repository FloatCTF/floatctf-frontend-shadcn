/** awd domain copy (English). */

export default {
	documentTitle: "{{title}} · FloatCTF",

	/** Action names for `call(...)` (only used in fallback errors when the backend sends no message). */
	actionNames: {
		status: "AWD event status",
		event: "Event details",
		submitFlag: "Flag submission",
		gameboxList: "GameBox list",
		resetGamebox: "GameBox reset",
		scores: "AWD scoreboard",
		wireguard: "WireGuard config",
		ssh: "SSH credentials",
	},

	arena: {
		titleFallback: "AWD Arena",
		description:
			"AWD competition cockpit: submit flags to attack opponents, monitor and reset your GameBoxes, and retrieve network credentials.",
		loading: "Loading AWD event status…",
		retryCheck: "Check again",

		breadcrumbs: {
			label: "Breadcrumb",
			events: "Events",
			workspace: "Event workspace",
			current: "AWD Arena",
		},

		banned: {
			title: "Your team is banned",
			description:
				"While banned, the backend rejects flag submissions, GameBox resets, and network access. Contact the event administrator if you believe this is a mistake.",
		},
		settlement: {
			title: "Final settlement in progress",
			description:
				"The last round has ended and the Judge is still settling scores. The competition is closed and no new submissions are accepted.",
		},

		empty: {
			title: "No AWD data",
			description: "The backend did not return AWD status. Refresh the page or contact an administrator.",
		},
		errors: {
			status: "Failed to load AWD status",
			event: "Failed to load event information",
		},
		notEnabled: {
			title: "AWD is not enabled for this event",
			description:
				"This event has no AWD configuration. Check the event format in the event list or contact an administrator.",
			action: "Back to events",
		},
		forbidden:
			"You are not a participant of this event (or have left your team), so you cannot view the AWD arena.",

		sections: {
			state: {
				title: "Rounds and status",
				description: "The backend advances phases and rounds; this page only shows the real values.",
			},
			tips: {
				title: "Attack flow",
				description:
					"Capability semantics match the Default frontend; this frontend redesigns the navigation path.",
			},
		},

		stats: {
			score: "My score",
			scoreHint: "Attack score + defense score",
			round: "Current round",
			roundHintUnknown: "Total rounds not configured",
			roundHint: "{{rounds}} rounds total",
			statusHint: "Streamed from the backend",
			phaseHint: "Advanced by the backend tick",
		},
		fields: {
			status: "Event status",
			phase: "Phase",
			teamStatus: "Team status",
			finalSettlement: "Final settlement",
		},
		event: {
			family: {
				jeopardy: "Jeopardy",
				awd: "AWD",
				awdp: "AWDP",
				unknown: "Unknown format",
			},
			joined: "Joined",
			notJoined: "Not joined",
			schedule: "Schedule",
			status: {
				upcoming: "Upcoming",
				ongoing: "Ongoing",
				ended: "Ended",
				unknown: "Unknown",
			},
		},
		tips: {
			wireguard:
				"Connect to the event intranet over WireGuard, then SSH into your GameBox (see Network credentials above).",
			phases:
				"During the <strong>hardening phase</strong> you may only fix your own vulnerabilities; flag submissions open in the <strong>attack phase</strong>.",
			reset:
				"Resetting a GameBox destroys the container and rebuilds it from the original image. Free resets and penalties apply, so use it carefully.",
			back: "Back to event workspace",
		},
	},

	state: {
		unknown: "Unknown",
		teamBanned: "Banned",
		teamNormal: "Normal",
		settlementActive: "In progress",
		settlementInactive: "No",
		status: {
			draft: "Draft",
			configuring: "Configuring",
			deploying: "Deploying",
			deployed: "Deployed",
			prechecking: "Prechecking",
			verified: "Verified",
			running: "Running",
			paused: "Paused",
			networkError: "Network error",
			startBlocked: "Start blocked",
			finished: "Finished",
			archived: "Archived",
			deployFailed: "Deployment failed",
			verificationFailed: "Verification failed",
		},
		phase: {
			hardening: "Hardening",
			attack: "Attack",
			pause: "Paused",
		},
		gamebox: {
			pending: "Pending",
			creating: "Creating",
			running: "Running",
			ready: "Ready",
			resetting: "Resetting",
			missing: "Missing",
			orphan: "Orphan container",
			conflict: "Resource conflict",
			startFailed: "Start failed",
			resetFailed: "Reset failed",
			stopped: "Stopped",
		},
	},

	gate: {
		notConfigured: "AWD is not configured.",
		banned: "Your team is banned; all player actions are closed.",
		finished: "The competition has ended.",
		finalSettlement: "Final settlement in progress — the competition is closed while the Judge finishes.",
		paused: "The competition is paused.",
		networkError: "Infrastructure network error; actions are temporarily unavailable.",
		hardening: "Attacks have not started yet (hardening phase).",
		notAttack: "Flags cannot be submitted in the current phase.",
		resetClosed: "GameBoxes cannot be reset in the current phase.",
	},

	flag: {
		title: "Submit flag",
		description:
			"Submit a flag captured from an opponent GameBox; it counts toward your attack score under the event rules.",
		round: "Round {{round}}",
		label: "flag",
		hint: "The flag is sent only to the backend for validation; it is never written to the URL or logs.",
		placeholder: "flag{...}",
		submit: "Submit",
		submitting: "Submitting…",
		success: "Flag submitted",
		error: "Failed to submit flag",
	},

	gamebox: {
		healthValues: {
			healthy: "healthy",
			unhealthy: "unhealthy",
			degraded: "degraded",
			unknown: "unknown",
			starting: "starting",
		},
		title: "My GameBoxes",
		description: "Only your team's instances in this event are shown; access their IPs through WireGuard / the intranet.",
		loadError: "Failed to load GameBoxes",
		empty: {
			title: "No GameBoxes",
			description:
				"The event may not be deployed yet, or your team was created after deployment (an administrator must redeploy).",
		},
		columns: {
			name: "GameBox",
			ip: "IP",
			status: "Status",
			health: "Health",
		},
		reset: "Reset",
		resetting: "Resetting…",
		resetHint: "Reset this GameBox",
		healthValue: "Health: {{health}}",
		confirm: {
			title: "Reset GameBox “{{name}}”?",
			description: "Resetting is destructive: it destroys the container and rebuilds it from the original image.",
			action: "Reset",
		},
		consequences: {
			dataLoss:
				"The GameBox container is destroyed and rebuilt from the original image: all changes you made inside it are lost.",
			penalty:
				"Resets are limited by the event's free reset count and over-limit penalty — further resets after the free quota is used deduct points under the event rules.",
			downtime:
				"The GameBox is briefly unavailable during the reset; SSH / WireGuard connections may drop and must be re-established.",
		},
		success: {
			title: "GameBox reset requested",
			description: "The container will be rebuilt from the original image; refresh later to see its status.",
		},
		resetError: "Failed to reset GameBox",
	},

	board: {
		title: "Live scoreboard",
		description: "Attack score = valid flags submitted; defense score = GameBox uptime.",
		loadError: "Failed to load scoreboard",
		empty: {
			title: "No scores yet",
			description: "This updates once the competition starts and points are scored.",
		},
		columns: {
			rank: "Rank",
			team: "Team",
			attack: "Attack",
			defense: "Defense",
			total: "Total",
		},
		myTeam: "My team",
		you: "(you)",
		mobileSummary: "Attack {{attack}} · Defense {{defense}}",
	},

	network: {
		title: "Network credentials",
		description: "Join the event intranet over WireGuard, then SSH into your GameBoxes.",
		tabs: {
			wireguard: "WireGuard",
			ssh: "SSH",
		},
	},

	wireguard: {
		loadError: "Failed to load WireGuard config",
		empty: {
			title: "No WireGuard config",
			description:
				"The backend has not issued a tunnel config yet; it appears after the event is deployed and you have joined your team.",
		},
		copy: "Copy .conf",
		copyAria: "Copy WireGuard config",
		download: "Download .conf",
		note: "The private key is returned only on first issue; save it now. Contact an administrator to rotate it if lost.",
		privateKey: "WireGuard private key",
	},

	ssh: {
		loadError: "Failed to load SSH credentials",
		empty: {
			title: "No SSH credentials",
			description:
				"The backend has not returned your team's SSH credentials yet; they appear after the event is deployed.",
		},
		noInstances: {
			title: "No instances",
			description: "Your team has no GameBoxes deployed yet, or deployment is still running.",
		},
		port: "Port",
		portLabel: "SSH port",
		password: "Password (shared by team)",
		passwordLabel: "SSH password",
		download: "Download credentials",
		commandLabel: "SSH command",
		columns: {
			ip: "IP",
			username: "Username",
			health: "Health",
			command: "Connection command",
		},
		file: {
			title: "FloatCTF AWD SSH access (event {{eventId}})",
			port: "Port: {{port}}",
			password: "Password: {{password}}",
		},
	},

	credentials: {
		eventNetwork: {
			title: "Event network not allocated",
			description:
				"An administrator has not allocated GameBox / WireGuard subnets for this event or completed deployment. Your WireGuard config and SSH credentials appear after allocation and deployment.",
		},
		teamNetwork: {
			title: "Team network not allocated",
			description:
				"The event network exists, but your team has no subnet yet (usually when the team was created after deployment); an administrator must redeploy.",
		},
		notJoined: {
			title: "Not on a team",
			description: "Join a team in this event to receive WireGuard config and SSH credentials.",
		},
		privateKey: {
			title: "Private key already issued",
			description:
				"The WireGuard private key is returned only on first retrieval; contact an administrator to rotate it if you need it again.",
		},
		notReady: {
			title: "Network credentials not available yet",
			description:
				"The event is not fully deployed, or your team has no usable instances; credentials appear after an administrator deploys.",
			descriptionWithMessage:
				"{{message}} — the event is not fully deployed, or your team has no usable instances; credentials appear after an administrator deploys.",
		},
		accessClosed: {
			title: "Network access is closed",
			description: "The competition has ended or is in final settlement; network access is closed.",
			descriptionWithMessage: "{{message}}",
		},
	},
};
