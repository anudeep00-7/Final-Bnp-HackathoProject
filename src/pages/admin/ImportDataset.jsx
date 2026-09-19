function ImportDataset() {
  return (
    <div>

      <div className="page-heading">
        <div>
          <h2>Import Dataset</h2>
          <p>Import and validate supplied datasets.</p>
        </div>
      </div>

      <div className="panel">

        <h3>Upload Dataset</h3>

        <div className="upload-box">

          <input type="file" accept=".csv" />

          <p>
            Select a CSV dataset to upload.
          </p>

        </div>

      </div>

    </div>
  );
}

export default ImportDataset;