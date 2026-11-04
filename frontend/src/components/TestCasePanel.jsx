function TestCasePanel({ question }) {

    const hasQuestion = question && typeof question === "object";
    const input = hasQuestion ? (question.input || "No Input") : "";
    const output = hasQuestion ? (question.output || "No Output") : "";

    return (

        <div className="test-card">

            <h2>🧪 Example Test Case</h2>

            <div className="case-box">

                <h4>Input</h4>

                <pre>{input}</pre>

            </div>

            <div className="case-box">

                <h4>Expected Output</h4>

                <pre>{output}</pre>

            </div>

        </div>

    );

}

export default TestCasePanel;
