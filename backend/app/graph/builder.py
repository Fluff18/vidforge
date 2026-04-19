from __future__ import annotations

from langgraph.graph import StateGraph, END
from app.graph.state import AgentState
from app.graph.nodes.clarify import clarify_node
from app.graph.nodes.research import research_node
from app.graph.nodes.prompt_forge import prompt_forge_node
from app.graph.nodes.video_gen import video_gen_node
from app.graph.nodes.deliver import deliver_node


def build_clarify_graph() -> StateGraph:
    graph = StateGraph(AgentState)
    graph.add_node("clarify", clarify_node)
    graph.set_entry_point("clarify")
    graph.add_edge("clarify", END)
    return graph


def build_research_graph() -> StateGraph:
    """Phase 1: research + prompt_forge → prompts_ready. User then reviews/edits prompts."""
    graph = StateGraph(AgentState)
    graph.add_node("research", research_node)
    graph.add_node("prompt_forge", prompt_forge_node)
    graph.set_entry_point("research")
    graph.add_edge("research", "prompt_forge")
    graph.add_edge("prompt_forge", END)
    return graph


def build_video_graph() -> StateGraph:
    """Phase 2: video_gen + deliver. Runs after user confirms/edits prompts."""
    graph = StateGraph(AgentState)
    graph.add_node("video_gen", video_gen_node)
    graph.add_node("deliver", deliver_node)
    graph.set_entry_point("video_gen")
    graph.add_edge("video_gen", "deliver")
    graph.add_edge("deliver", END)
    return graph


clarify_graph = build_clarify_graph().compile()
research_graph = build_research_graph().compile()
video_graph = build_video_graph().compile()

# Legacy alias so existing imports don't break
generation_graph = None  # replaced by research_graph + video_graph
