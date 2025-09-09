# GKCCI Privacy Policy Labeling Dashboard

A web-based visualization tool for analyzing privacy policy annotations using the GKCCI 8-parameter framework. This dashboard helps track consistency and quality of annotations made by law students from the University of Iowa in collaboration with Colgate University.

## GKCCI Framework Parameters

The dashboard analyzes annotations using 8 key parameters:

1. **Sender** - Who is sending/collecting the data
2. **Subject** - What the data is about (the data subject)  
3. **Information Type** - Type of information being processed
4. **Recipient** - Who receives or has access to the data
5. **Aim** - Purpose or goal of data processing
6. **Condition** - Under what conditions data is processed
7. **Modalities** - How the data processing is carried out
8. **Consequence** - What happens as a result of processing

## Quick Start

### 1. Setup
```bash
# Download or clone the repository
# No build process required - pure HTML/CSS/JavaScript

# Open index.html in your web browser
open index.html
```

### Use these demo accounts to test the system:

**Law Student Demo:**
- Email: `student.demo@uiowa.edu`
- Password: `demo123`

**Professor Demo:**
- Email: `professor.demo@colgate.edu`  
- Password: `demo123`

### 2. Connect to Label Studio

#### Option A: Live API Connection (Recommended)
1. Open Label Studio in your browser
2. Go to Account & Settings → Access Token
3. Copy your API token
4. In the dashboard:
   - Enter your Label Studio URL (e.g., `http://localhost:8080`)
   - Paste your API token
   - Select your GKCCI privacy policy project
   - Click "Fetch Live Data"

#### Option B: File Upload
1. Export your project data from Label Studio as JSON
2. Drag and drop the file onto the upload area
3. The dashboard will automatically process the annotations

#### Option C: JSON Paste
1. Copy annotation data from Label Studio
2. Paste it into the JSON input area
3. Click "Process JSON"

### 3. View Results
- **Label Distribution**: See which GKCCI parameters are most/least annotated
- **Agreement Tracking**: Monitor consistency between law students over time
- **Individual Performance**: Track each student's annotation quality
- **Quality Metrics**: Overall agreement rates and Cohen's Kappa scores

## File Structure

```
privacy-dashboard/
├── index.html              # Main HTML file
├── css/
│   ├── styles.css          # Main stylesheet
│   └── responsive.css      # Mobile responsiveness
├── js/
│   ├── main.js            # Core application logic
│   ├── labelstudio.js     # Label Studio integration
│   ├── charts.js          # Chart visualization logic
│   └── utils.js           # Utility functions
├── data/
│   └── sample-data.json   # Sample GKCCI annotation data
└── docs/
    └── README.md          # This file
```

## Features

### Real-time Data Integration
- **Live Label Studio Connection**: Direct API integration with your Label Studio workspace
- **Multiple Import Methods**: File upload, JSON paste, or API connection
- **Automatic Processing**: Handles different Label Studio export formats

### GKCCI-Specific Analytics
- **8-Parameter Tracking**: Monitors all GKCCI framework parameters
- **Color-coded Visualization**: Each parameter has a distinct color for easy identification
- **Cross-jurisdictional Analysis**: Track annotations across different legal jurisdictions

### Collaboration Features
- **Multi-annotator Support**: Track multiple law students simultaneously
- **University Integration**: Designed for Colgate-Iowa collaboration
- **Performance Metrics**: Individual and group annotation quality metrics

### Export & Reporting
- **JSON Export**: Download analysis results for research papers
- **Academic Formatting**: Ready for inclusion in academic publications
- **Filter & Search**: Focus on specific time periods, students, or projects

## Usage Examples

### Analyzing Label Consistency
```javascript
// The dashboard automatically calculates:
// - Inter-annotator agreement for each GKCCI parameter
// - Overall project consistency scores
// - Individual law student performance metrics
```

### Tracking Research Progress
- Monitor how many privacy policies have been annotated
- Track which GKCCI parameters need more attention
- Identify law students who might need additional training

### Academic Research Integration
- Export data in formats suitable for academic papers
- Generate visualizations for research presentations
- Track annotation quality over time for methodology sections

## Label Studio Configuration

### Project Setup
1. Create a new project in Label Studio
2. Use this labeling configuration for GKCCI parameters:

```xml
<View>
  <Text name="text" value="$text"/>
  <Choices name="gkcci_labels" toName="text" choice="multiple">
    <Choice value="Sender"/>
    <Choice value="Subject"/>
    <Choice value="Information Type"/>
    <Choice value="Recipient"/>
    <Choice value="Aim"/>
    <Choice value="Condition"/>
    <Choice value="Modalities"/>
    <Choice value="Consequence"/>
  </Choices>
</View>
```

### Data Format
Your Label Studio tasks should include:
```json
{
  "text": "Privacy policy text to be annotated...",
  "source": "Company Privacy Policy",
  "jurisdiction": "US",
  "policy_section": "Data Collection"
}
```

## Deployment Options

### Local Development
- Open `index.html` directly in your browser
- No server required for basic functionality

### University Server
- Upload files to Colgate or Iowa web server
- Share URL with research team members

### GitHub Pages (Free)
1. Create a GitHub repository
2. Upload all files
3. Enable GitHub Pages in repository settings
4. Share the generated URL

### Cloud Hosting
- Deploy to Netlify, Vercel, or similar platforms
- Custom domain support available
- Automatic HTTPS included

## Browser Support

- **Recommended**: Chrome, Firefox, Safari, Edge (latest versions)
- **Minimum**: Any modern browser with ES6 support
- **Mobile**: Responsive design works on tablets and phones

## Troubleshooting

### Connection Issues
- **CORS Errors**: Ensure Label Studio allows connections from your domain
- **API Token**: Verify your token is correct and has project access
- **URL Format**: Include `http://` or `https://` in Label Studio URL

### Data Import Problems
- **File Format**: Only JSON files are supported
- **Large Files**: Files over 50MB may cause browser slowdown
- **Invalid JSON**: Use a JSON validator to check file format

### Performance Issues
- **Large Datasets**: Consider filtering data by date range
- **Browser Memory**: Close other tabs if charts don't load
- **Network Speed**: API connections require stable internet

## Contributing

This is a research tool for the Colgate-Iowa collaboration. For feature requests or issues:

1. Document the issue with screenshots
2. Include sample data if relevant  
3. Specify browser and Label Studio versions
4. Contact the research team

## Research Context

This dashboard is part of ongoing research into privacy policy analysis using the GKCCI framework. It supports:

- **Cross-institutional Collaboration**: Colgate University × University of Iowa
- **Legal Education**: Training law students in privacy policy analysis
- **Academic Research**: Generating data for scholarly publications
- **Policy Analysis**: Understanding privacy policy structures across jurisdictions

## Privacy & Security

- **No Data Storage**: All processing happens in your browser
- **Secure Connections**: Uses HTTPS when available
- **Local Processing**: Your annotation data never leaves your control
- **API Security**: Uses Label Studio's built-in authentication

## License

This tool is developed for academic research purposes. Contact the research team for usage permissions outside of the Colgate-Iowa collaboration.

## Support

For technical support or research questions:
- **Colgate University**: Contact your research supervisor
- **University of Iowa**: Contact the law school research team
- **Technical Issues**: Check browser console for error messages