import Meta from 'gi://Meta';

const BLURRED_FRAME_TYPES = [
    Meta.FrameType.NORMAL,
    Meta.FrameType.DIALOG,
    Meta.FrameType.MODAL_DIALOG,
    Meta.FrameType.ATTACHED,
];

const BLURRED_WINDOW_TYPES = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.UTILITY,
    Meta.WindowType.TOOLBAR,
    Meta.WindowType.MENU,
    Meta.WindowType.POPUP_MENU,
    Meta.WindowType.DROPDOWN_MENU,
    Meta.WindowType.COMBO,
    Meta.WindowType.OVERRIDE_OTHER,
];

const EXCLUDED_WINDOW_TYPES = [
    Meta.WindowType.DESKTOP,
    Meta.WindowType.DOCK,
];

/// Converts a case-insensitive wildcard pattern, where `*` matches any sequence and `?` any single
/// character, to a RegExp.
function wildcard_to_regex(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regex = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    return new RegExp(regex, 'i');
}

function matches_any(value, patterns) {
    return Boolean(value) && patterns.some(pattern => pattern.test(value));
}

/// Decides which windows are blurred: when blurring every window, those not in the blacklist,
/// else only those in the whitelist.
export class WindowRules {
    constructor(settings) {
        this.settings = settings;
        this.update();
    }

    update() {
        this.whitelist = this.settings.applications.WHITELIST.map(wildcard_to_regex);
        this.blacklist = this.settings.applications.BLACKLIST.map(wildcard_to_regex);
    }

    matches(meta_window) {
        if (!meta_window)
            return false;

        const window_type = meta_window.get_window_type();
        if (EXCLUDED_WINDOW_TYPES.includes(window_type))
            return false;

        let wm_class = meta_window.get_wm_class();
        if (!wm_class)
            wm_class = meta_window.get_gtk_application_id() || meta_window.get_sandboxed_app_id() || '';

        // If this is a transient/child window or dialog with no wm_class of its own,
        // inherit identification from the parent window
        if (!wm_class && meta_window.get_transient_for) {
            const parent = meta_window.get_transient_for();
            if (parent) {
                wm_class = parent.get_wm_class()
                    || parent.get_gtk_application_id()
                    || parent.get_sandboxed_app_id()
                    || '';
            }
        }

        const is_dialog_or_popup = (meta_window.is_attached_dialog && meta_window.is_attached_dialog())
            || (meta_window.get_transient_for && meta_window.get_transient_for() != null)
            || window_type === Meta.WindowType.DIALOG
            || window_type === Meta.WindowType.MODAL_DIALOG
            || window_type === Meta.WindowType.POPUP_MENU
            || window_type === Meta.WindowType.DROPDOWN_MENU
            || window_type === Meta.WindowType.MENU
            || window_type === Meta.WindowType.COMBO
            || window_type === Meta.WindowType.UTILITY;

        const listed = this.settings.applications.ENABLE_ALL
            ? (!wm_class || !matches_any(wm_class, this.blacklist))
            : (wm_class && matches_any(wm_class, this.whitelist));

        if (!listed)
            return false;

        const frame_type = meta_window.get_frame_type();
        const valid_frame = BLURRED_FRAME_TYPES.includes(frame_type);
        const valid_window = BLURRED_WINDOW_TYPES.includes(window_type);

        return valid_frame || valid_window || is_dialog_or_popup;
    }
}
