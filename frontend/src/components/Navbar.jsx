import { FaBell, FaUserCircle, FaSignOutAlt } from "react-icons/fa";

import { Link, useNavigate, useLocation } from "react-router-dom";

function Navbar() {
    let name;
    try {
        name = localStorage.getItem("name") || "Happy";
    } catch {
        name = "Happy";
    }
    const navigate = useNavigate();
    const location = useLocation();

    const links = [
        { to: "/dashboard", label: "🏠 Dashboard" },
        { to: "/learn", label: "📚 Learn Hub" },
        { to: "/weekly-test", label: "🗓️ Weekly Test" },
        { to: "/coding", label: "💻 Coding" },
    ];

    const logout = () => {
        try {
            localStorage.removeItem("token");
            localStorage.removeItem("email");
            localStorage.removeItem("name");
        } catch {
            // ignore
        }
        navigate("/", { replace: true });
    };

    return (

        <nav className="navbar">

            <div className="logo">
                🤖 AI Interview Platform
            </div>

            <div className="nav-links">
                {links.map((l) => (
                    <Link
                        key={l.to}
                        to={l.to}
                        className={`nav-link ${location.pathname === l.to ? "active" : ""}`}
                    >
                        {l.label}
                    </Link>
                ))}
            </div>

            <div className="nav-right">

                <FaBell className="nav-icon"/>

                <div className="profile">

                    <FaUserCircle/>

                    <span>{name}</span>

                </div>

                <button
                    className="logout-btn"
                    onClick={logout}
                >

                    <FaSignOutAlt/>

                    Logout

                </button>

            </div>

        </nav>

    );

}

export default Navbar;