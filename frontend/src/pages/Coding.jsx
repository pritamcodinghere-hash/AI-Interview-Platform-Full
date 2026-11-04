import { useState } from "react";

import CodingNavbar from "../components/CodingNavbar";
import ProblemPanel from "../components/ProblemPanel";
import TestCasePanel from "../components/TestCasePanel";
import EditorPanel from "../components/EditorPanel";
import CodingBottomPanel from "../components/CodingBottomPanel";
import ComplexityPanel from "../components/ComplexityPanel";
import FeedbackPanel from "../components/FeedbackPanel";

import "../styles/Coding.css";

const DEFAULT_CODE = `import java.util.*;

public class Solution {

    public static void main(String[] args){

        Scanner sc = new Scanner(System.in);

        String s = sc.nextLine();

        System.out.println(new StringBuilder(s).reverse());

    }

}`;

function Coding() {

    const [output, setOutput] = useState("");

    const [input, setInput] = useState("");

    const [question, setQuestion] = useState("");

    const [code, setCode] = useState(DEFAULT_CODE);

    const [language, setLanguage] = useState("java");

    return (

        <div className="coding-page">

            <CodingNavbar />

            <div className="coding-main">

                <div className="left-side">

                    <ProblemPanel
                        question={question}
                        setQuestion={setQuestion}
                    />

                </div>

                <div className="right-side">

                    <TestCasePanel
                        question={question}
                    />

                    <ComplexityPanel
                        question={question}
                        code={code}
                        language={language}
                    />

                </div>

            </div>

            <EditorPanel
                setOutput={setOutput}
                input={input}
                question={question}
                code={code}
                setCode={setCode}
                language={language}
                setLanguage={setLanguage}
                defaultCode={DEFAULT_CODE}
            />

            <CodingBottomPanel
                key={question && typeof question === "object" ? question.id : "none"}
                question={question}
                code={code}
                language={language}
                output={output}
                input={input}
                setInput={setInput}
            />

            <FeedbackPanel feedback={output} />
        </div>
    );
}

export default Coding;
