from typing import Any


CAMPAIGN_NOTE_DOC_SCHEMA_VERSION = "campaign_note_doc_v1"
ALLOWED_MARK_TYPES = {"bold", "italic"}
ALLOWED_BLOCK_TYPES = {"paragraph", "heading", "blockquote", "bullet_list", "ordered_list"}
ALLOWED_INLINE_TYPES = {"text", "hard_break"}


def default_campaign_note_body() -> dict[str, Any]:
    return {
        "schema_version": CAMPAIGN_NOTE_DOC_SCHEMA_VERSION,
        "type": "doc",
        "content": [],
        "linked_rules": [],
    }


def validate_campaign_note_body_shape(body: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ValueError("body must be a JSON object")

    schema_version = body.get("schema_version")
    if schema_version != CAMPAIGN_NOTE_DOC_SCHEMA_VERSION:
        raise ValueError(f"body.schema_version must be {CAMPAIGN_NOTE_DOC_SCHEMA_VERSION}")

    if body.get("type") != "doc":
        raise ValueError("body.type must be 'doc'")

    content = body.get("content")
    if not isinstance(content, list):
        raise ValueError("body.content must be an array")

    for index, node in enumerate(content):
        validate_block_node(node, f"body.content[{index}]")

    linked_rules = body.get("linked_rules", [])
    if not isinstance(linked_rules, list):
        raise ValueError("body.linked_rules must be an array")

    for index, link in enumerate(linked_rules):
        validate_linked_rule(link, f"body.linked_rules[{index}]")

    return body


def validate_linked_rule(link: Any, path: str) -> None:
    if not isinstance(link, dict):
        raise ValueError(f"{path} must be an object")

    if not isinstance(link.get("content_id"), str) or not link.get("content_id"):
        raise ValueError(f"{path}.content_id must be a non-empty string")

    if "label" in link and link.get("label") is not None and not isinstance(link.get("label"), str):
        raise ValueError(f"{path}.label must be a string or null")

    if link.get("link_mode") not in {"live", "snapshot"}:
        raise ValueError(f"{path}.link_mode must be 'live' or 'snapshot'")

    if "pinned_version_num" in link and link.get("pinned_version_num") is not None:
        pinned_version_num = link.get("pinned_version_num")
        if not isinstance(pinned_version_num, int) or pinned_version_num < 1:
            raise ValueError(f"{path}.pinned_version_num must be an integer greater than 0 or null")


def validate_block_node(node: Any, path: str) -> None:
    if not isinstance(node, dict):
        raise ValueError(f"{path} must be an object")

    node_type = node.get("type")
    if node_type not in ALLOWED_BLOCK_TYPES:
        raise ValueError(f"{path}.type must be one of {sorted(ALLOWED_BLOCK_TYPES)}")

    if node_type == "paragraph":
        validate_inline_content(node.get("content", []), f"{path}.content")
        return

    if node_type == "heading":
        attrs = node.get("attrs")
        if not isinstance(attrs, dict):
            raise ValueError(f"{path}.attrs must be an object")
        level = attrs.get("level")
        if level not in {1, 2, 3}:
            raise ValueError(f"{path}.attrs.level must be 1, 2, or 3")
        validate_inline_content(node.get("content", []), f"{path}.content")
        return

    if node_type == "blockquote":
        nested = node.get("content", [])
        if not isinstance(nested, list):
            raise ValueError(f"{path}.content must be an array")
        for index, child in enumerate(nested):
            validate_block_node(child, f"{path}.content[{index}]")
        return

    validate_list_content(node.get("content", []), f"{path}.content")


def validate_list_content(content: Any, path: str) -> None:
    if not isinstance(content, list):
        raise ValueError(f"{path} must be an array")

    for index, item in enumerate(content):
        validate_list_item(item, f"{path}[{index}]")


def validate_list_item(node: Any, path: str) -> None:
    if not isinstance(node, dict):
        raise ValueError(f"{path} must be an object")

    if node.get("type") != "list_item":
        raise ValueError(f"{path}.type must be 'list_item'")

    content = node.get("content", [])
    if not isinstance(content, list):
        raise ValueError(f"{path}.content must be an array")

    for index, child in enumerate(content):
        validate_block_node(child, f"{path}.content[{index}]")


def validate_inline_content(content: Any, path: str) -> None:
    if not isinstance(content, list):
        raise ValueError(f"{path} must be an array")

    for index, node in enumerate(content):
        validate_inline_node(node, f"{path}[{index}]")


def validate_inline_node(node: Any, path: str) -> None:
    if not isinstance(node, dict):
        raise ValueError(f"{path} must be an object")

    node_type = node.get("type")
    if node_type not in ALLOWED_INLINE_TYPES:
        raise ValueError(f"{path}.type must be one of {sorted(ALLOWED_INLINE_TYPES)}")

    if node_type == "text":
        if not isinstance(node.get("text"), str):
            raise ValueError(f"{path}.text must be a string")
        marks = node.get("marks")
        if marks is None:
            return
        if not isinstance(marks, list):
            raise ValueError(f"{path}.marks must be an array")
        for mark_index, mark in enumerate(marks):
            if not isinstance(mark, dict):
                raise ValueError(f"{path}.marks[{mark_index}] must be an object")
            if mark.get("type") not in ALLOWED_MARK_TYPES:
                raise ValueError(f"{path}.marks[{mark_index}].type must be one of {sorted(ALLOWED_MARK_TYPES)}")
