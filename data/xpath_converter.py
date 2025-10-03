from lxml import html

def xpath_to_offsets(html_string, xpath, substring=None):
    doc = html.fromstring(html_string)
    nodes = doc.xpath(xpath)
    if not nodes:
        raise ValueError(f"No node found for XPath: {xpath}")
    node_text = str(nodes[0])

    flat_text = ""
    offsets = {}
    pos = 0
    for elem in doc.itertext():
        start = pos
        flat_text += elem
        end = pos + len(elem)
        offsets[elem] = (start, end)
        pos = end

    global_start, global_end = offsets[node_text]

    if substring:
        local_index = node_text.find(substring)
        if local_index == -1:
            raise ValueError(f"Substring '{substring}' not found in node '{node_text}'")
        start_offset = global_start + local_index
        end_offset = start_offset + len(substring)
    else:
        start_offset, end_offset = global_start, global_end

    return start_offset, end_offset